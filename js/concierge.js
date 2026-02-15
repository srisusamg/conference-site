import { getPipe, runQueued, isAIEnabled } from "./ai/aiCore.js";
import { setAIStatus } from "./ai/aiStatusUI.js";
import { requireEventId, eventDataPath } from "./eventContext.js";
import { url, withQuery } from "./shared/basePath.js";
import { truncateText } from "./shared/textLimit.js";
import { sessionAnchorId, vendorAnchorId, announcementAnchorId } from "./shared/anchorIds.js";

const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const QA_MODEL = "Xenova/distilbert-base-cased-distilled-squad";
const CACHE_PREFIX = "ai:event-embeddings:";
const BATCH_SIZE = 8;
const TOP_K = 5;
const QA_CONTEXT_ITEMS = 3;
const QA_CONTEXT_SNIPPET_LIMIT = 220;
const QA_CONTEXT_TOTAL_LIMIT = 700;
const QUESTION_LIMIT = 260;

const state = {
  eventId: null,
  version: "v1",
  corpus: [],
  vectors: [],
  topMatches: []
};

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const va = Number(a[index]) || 0;
    const vb = Number(b[index]) || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }

  if (!magA || !magB) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function cacheKey(eventId) {
  return `${CACHE_PREFIX}${eventId}`;
}

function toCompactVector(vector) {
  return vector.map((value) => Number(Number(value).toFixed(6)));
}

function parseEmbeddingOutput(result) {
  if (!result) {
    return [];
  }

  if (Array.isArray(result)) {
    if (Array.isArray(result[0])) {
      return result.map((row) => row.map((value) => Number(value) || 0));
    }
    return [result.map((value) => Number(value) || 0)];
  }

  if (result.data && Array.isArray(result.dims) && result.dims.length >= 2) {
    const [rows, cols] = result.dims;
    const vectors = [];
    for (let row = 0; row < rows; row += 1) {
      const start = row * cols;
      const end = start + cols;
      vectors.push(Array.from(result.data.slice(start, end), (value) => Number(value) || 0));
    }
    return vectors;
  }

  if (typeof result.tolist === "function") {
    const data = result.tolist();
    if (Array.isArray(data[0])) {
      return data.map((row) => row.map((value) => Number(value) || 0));
    }
    return [data.map((value) => Number(value) || 0)];
  }

  return [];
}

async function fetchJson(path) {
  const response = await fetch(url(path));
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function loadEventData(eventId) {
  const [sessionsPayload, vendorsPayload, announcementsPayload, conferencePayload, metaPayload] = await Promise.all([
    fetchJson(eventDataPath(eventId, "sessions.json")),
    fetchJson(eventDataPath(eventId, "vendors.json")),
    fetchJson(eventDataPath(eventId, "announcements.json")),
    fetchJson(eventDataPath(eventId, "conference.json")),
    fetch(url(eventDataPath(eventId, "meta.json"))).then(async (response) => {
      if (!response.ok) {
        return null;
      }
      return response.json();
    }).catch(() => null)
  ]);

  return {
    sessions: Array.isArray(sessionsPayload.sessions) ? sessionsPayload.sessions : [],
    vendors: Array.isArray(vendorsPayload.vendors) ? vendorsPayload.vendors : [],
    announcements: Array.isArray(announcementsPayload.announcements) ? announcementsPayload.announcements : [],
    conference: conferencePayload || {},
    version: String(metaPayload?.version || metaPayload?.updatedAt || "v1")
  };
}

function buildSessionSnippet(session, index) {
  const id = session.id || `session-${index + 1}`;
  const title = session.title || "Session";
  const shortDescription = session.description || `${session.track || "General"} session`;
  const locationOrBoothOrTime = [session.time, session.room].filter(Boolean).join(" • ") || "TBA";

  return {
    sourceType: "session",
    sourceId: String(id),
    title,
    text: `Session: ${title}. ${truncateText(shortDescription, 180)}. ${locationOrBoothOrTime}`,
    link: `${withQuery("pages/agenda.html", { id: state.eventId })}#${sessionAnchorId(id)}`
  };
}

function buildVendorSnippet(vendor, index) {
  const id = vendor.id || vendor.name || `vendor-${index + 1}`;
  const title = vendor.name || "Vendor";
  const shortDescription = vendor.deal || (Array.isArray(vendor.categories) ? vendor.categories.join(", ") : "") || "Vendor services";
  const locationOrBoothOrTime = vendor.booth ? `Booth ${vendor.booth}` : "Expo Hall";

  return {
    sourceType: "vendor",
    sourceId: String(id),
    title,
    text: `Vendor: ${title}. ${truncateText(shortDescription, 180)}. ${locationOrBoothOrTime}`,
    link: `${withQuery("pages/vendors.html", { id: state.eventId })}#${vendorAnchorId(id)}`
  };
}

function buildAnnouncementSnippet(item, index) {
  const id = item.id || item.title || `announcement-${index + 1}`;
  const title = item.title || "Announcement";
  const shortDescription = item.body || "Event update";
  const locationOrBoothOrTime = item.date || "Latest";

  return {
    sourceType: "announcement",
    sourceId: String(id),
    title,
    text: `Announcement: ${title}. ${truncateText(shortDescription, 180)}. ${locationOrBoothOrTime}`,
    link: `${withQuery("pages/announcements.html", { id: state.eventId })}#${announcementAnchorId(id)}`
  };
}

function buildVenueSnippet(conference) {
  const title = conference.name || "Venue";
  const shortDescription = conference.description || conference.theme || "Event venue details";
  const locationOrBoothOrTime = [conference.venue, conference.city, conference.dateRange].filter(Boolean).join(" • ") || "Venue TBA";

  return {
    sourceType: "venue",
    sourceId: String(conference.id || state.eventId),
    title,
    text: `Venue: ${title}. ${truncateText(shortDescription, 180)}. ${locationOrBoothOrTime}`,
    link: withQuery("pages/venue.html", { id: state.eventId })
  };
}

function buildCorpus(payload) {
  const snippets = [];

  payload.sessions.forEach((session, index) => {
    snippets.push(buildSessionSnippet(session, index));
  });

  payload.vendors.forEach((vendor, index) => {
    snippets.push(buildVendorSnippet(vendor, index));
  });

  payload.announcements.forEach((announcement, index) => {
    snippets.push(buildAnnouncementSnippet(announcement, index));
  });

  snippets.push(buildVenueSnippet(payload.conference));
  return snippets;
}

function readCachedEmbeddings(eventId, version) {
  try {
    const raw = localStorage.getItem(cacheKey(eventId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (parsed.version !== version || parsed.model !== EMBEDDING_MODEL) {
      return null;
    }

    if (!Array.isArray(parsed.corpus) || !Array.isArray(parsed.vectors)) {
      return null;
    }

    if (parsed.corpus.length !== parsed.vectors.length) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCachedEmbeddings(eventId, version, corpus, vectors) {
  try {
    localStorage.setItem(cacheKey(eventId), JSON.stringify({
      version,
      model: EMBEDDING_MODEL,
      corpus,
      vectors
    }));
  } catch (error) {
    console.warn("Unable to cache embeddings:", error);
  }
}

function clearCachedEmbeddings(eventId) {
  localStorage.removeItem(cacheKey(eventId));
}

async function ensureEmbeddings() {
  if (state.corpus.length && state.vectors.length) {
    return;
  }

  const cached = readCachedEmbeddings(state.eventId, state.version);
  if (cached) {
    state.corpus = cached.corpus;
    state.vectors = cached.vectors;
    return;
  }

  if (!isAIEnabled()) {
    throw new Error("Enable AI in the navbar to compute concierge retrieval.");
  }

  const embedder = await runQueued(() => getPipe("feature-extraction", EMBEDDING_MODEL, {
    device: "wasm",
    dtypeWasm: "q8",
    onStatus: setAIStatus
  }));

  const vectors = [];
  for (let index = 0; index < state.corpus.length; index += BATCH_SIZE) {
    const batch = state.corpus.slice(index, index + BATCH_SIZE);
    const texts = batch.map((item) => item.text);

    const output = await runQueued(() => embedder(texts, {
      pooling: "mean",
      normalize: true
    }));

    const parsed = parseEmbeddingOutput(output);
    parsed.forEach((vector) => {
      vectors.push(toCompactVector(vector));
    });
  }

  state.vectors = vectors;
  writeCachedEmbeddings(state.eventId, state.version, state.corpus, vectors);
}

function renderMatches(matches) {
  const container = document.getElementById("concierge-results");
  container.innerHTML = "";

  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No matches yet. Ask a question to start.";
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  matches.forEach((item, idx) => {
    const card = document.createElement("article");
    card.className = "concierge-card";

    const title = document.createElement("h3");
    title.className = "concierge-card-title";
    title.textContent = `${idx + 1}. ${item.title}`;

    const body = document.createElement("p");
    body.className = "concierge-card-text";
    body.textContent = item.text;

    const source = document.createElement("a");
    source.className = "event-card-link";
    source.href = url(item.link);
    source.textContent = "Open source";

    card.append(title, body, source);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

async function retrieveTopMatches(question) {
  await ensureEmbeddings();

  const embedder = await runQueued(() => getPipe("feature-extraction", EMBEDDING_MODEL, {
    device: "wasm",
    dtypeWasm: "q8",
    onStatus: setAIStatus
  }));

  const output = await runQueued(() => embedder([question], {
    pooling: "mean",
    normalize: true
  }));

  const [questionVector] = parseEmbeddingOutput(output);
  if (!questionVector) {
    return [];
  }

  const scored = state.corpus.map((item, index) => ({
    ...item,
    score: cosineSimilarity(questionVector, state.vectors[index] || [])
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, TOP_K);
}

function buildAnswerContext(matches) {
  const top = matches.slice(0, QA_CONTEXT_ITEMS);
  const chunks = [];
  let used = 0;

  top.forEach((item) => {
    if (used >= QA_CONTEXT_TOTAL_LIMIT) {
      return;
    }

    const snippet = truncateText(item.text, QA_CONTEXT_SNIPPET_LIMIT);
    const remaining = QA_CONTEXT_TOTAL_LIMIT - used;
    const clipped = truncateText(snippet, remaining);
    chunks.push(clipped);
    used += clipped.length;
  });

  return chunks.join("\n\n");
}

function renderAnswer(answer, score, sources) {
  const box = document.getElementById("concierge-answer-box");
  const text = document.getElementById("concierge-answer-text");
  const scoreEl = document.getElementById("concierge-answer-score");
  const sourceList = document.getElementById("concierge-answer-sources");

  text.textContent = answer || "No short answer found in top event snippets.";
  scoreEl.textContent = `Confidence: ${Number(score || 0).toFixed(3)}`;

  sourceList.innerHTML = "";
  sources.forEach((item) => {
    const li = document.createElement("li");
    const anchor = document.createElement("a");
    anchor.href = url(item.link);
    anchor.textContent = item.title;
    li.appendChild(anchor);
    sourceList.appendChild(li);
  });

  box.hidden = false;
}

async function answerFromTopMatches(question) {
  if (!state.topMatches.length) {
    return;
  }

  const context = buildAnswerContext(state.topMatches);
  if (!context) {
    renderAnswer("No relevant context available.", 0, []);
    return;
  }

  const qa = await runQueued(() => getPipe("question-answering", QA_MODEL, {
    device: "wasm",
    dtypeWasm: "q8",
    onStatus: setAIStatus
  }));

  const qaResult = await runQueued(() => qa({
    question,
    context
  }));

  renderAnswer(
    truncateText(qaResult?.answer || "No short answer found.", 260),
    qaResult?.score || 0,
    state.topMatches.slice(0, QA_CONTEXT_ITEMS)
  );
}

function setBusy(button, busy, textWhenBusy) {
  if (!button) {
    return;
  }
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = textWhenBusy;
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

function bindActions() {
  const questionInput = document.getElementById("concierge-question");
  const retrieveButton = document.getElementById("concierge-retrieve");
  const answerButton = document.getElementById("concierge-answer");
  const clearCacheButton = document.getElementById("concierge-clear-cache");
  const note = document.getElementById("concierge-note");

  retrieveButton.addEventListener("click", async () => {
    const question = truncateText(questionInput.value.trim(), QUESTION_LIMIT);
    if (!question) {
      note.textContent = "Please enter a question first.";
      return;
    }

    if (!isAIEnabled()) {
      setAIStatus({ state: "idle", message: "Enable AI to use concierge search." });
      note.textContent = "Enable AI in navbar first. Models are on-device and downloaded once.";
      return;
    }

    try {
      setBusy(retrieveButton, true, "Finding...");
      setAIStatus({ state: "loading", message: "Preparing retrieval..." });
      const matches = await retrieveTopMatches(question);
      state.topMatches = matches;
      renderMatches(matches);
      answerButton.disabled = !matches.length;
      note.textContent = "Top matches are ready.";
      setAIStatus({ state: "ready", message: "Top matches ready." });
    } catch (error) {
      console.error(error);
      note.textContent = error?.message || "Unable to run retrieval.";
      setAIStatus({ state: "error", message: "Retrieval failed." });
    } finally {
      setBusy(retrieveButton, false, "Finding...");
    }
  });

  answerButton.addEventListener("click", async () => {
    const question = truncateText(questionInput.value.trim(), QUESTION_LIMIT);
    if (!question) {
      return;
    }

    if (!state.topMatches.length) {
      return;
    }

    try {
      setBusy(answerButton, true, "Answering...");
      setAIStatus({ state: "loading", message: "Generating short answer..." });
      await answerFromTopMatches(question);
      note.textContent = "Short answer generated from top sources.";
      setAIStatus({ state: "ready", message: "Short answer ready." });
    } catch (error) {
      console.error(error);
      note.textContent = error?.message || "Unable to generate answer.";
      setAIStatus({ state: "error", message: "Answer generation failed." });
    } finally {
      setBusy(answerButton, false, "Answering...");
    }
  });

  clearCacheButton.addEventListener("click", () => {
    clearCachedEmbeddings(state.eventId);
    state.vectors = [];
    state.topMatches = [];
    renderMatches([]);
    answerButton.disabled = true;
    document.getElementById("concierge-answer-box").hidden = true;
    note.textContent = "AI cache cleared for this event.";
    setAIStatus({ state: "idle", message: "" });
  });
}

async function initConcierge() {
  const eventId = requireEventId();
  if (!eventId) {
    return;
  }

  localStorage.setItem("selectedEventId", eventId);
  state.eventId = eventId;

  try {
    const payload = await loadEventData(eventId);
    state.version = payload.version;
    state.corpus = buildCorpus(payload);
    state.vectors = [];
    state.topMatches = [];

    const answerButton = document.getElementById("concierge-answer");
    answerButton.disabled = true;

    renderMatches([]);
    bindActions();
  } catch (error) {
    console.error(error);
    const results = document.getElementById("concierge-results");
    results.textContent = "Unable to load concierge data right now.";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initConcierge);
} else {
  initConcierge();
}
