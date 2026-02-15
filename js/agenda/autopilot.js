import { getPipe, runQueued, isAIEnabled } from "../ai/aiCore.js";
import { setAIStatus } from "../ai/aiStatusUI.js";
import { url } from "../shared/basePath.js";
import { eventDataPath } from "../eventContext.js";
import { truncateText } from "../shared/textLimit.js";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const BATCH_SIZE = 8;
const CACHE_PREFIX = "ai:agenda-embeddings:";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDayIndex(day) {
  const text = String(day || "");
  const match = text.match(/(\d+)/);
  if (match) {
    return Math.max(0, Number(match[1]) - 1);
  }
  return 0;
}

function parseClockToMinutes(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  let hour = rawHour % 12;
  if (meridiem === "PM") {
    hour += 12;
  }

  return (hour * 60) + minute;
}

function parseSessionRange(value) {
  const text = String(value || "");
  const parts = text.split("-").map((item) => item.trim());
  if (parts.length < 2) {
    return null;
  }

  const start = parseClockToMinutes(parts[0]);
  const end = parseClockToMinutes(parts[1]);
  if (start === null || end === null) {
    return null;
  }

  return { start, end: end >= start ? end : start + 1 };
}

function getAbsoluteRange(session) {
  const range = parseSessionRange(session.time);
  if (!range) {
    return null;
  }

  const dayOffset = parseDayIndex(session.day) * 24 * 60;
  return {
    startAbs: dayOffset + range.start,
    endAbs: dayOffset + range.end,
    startLocal: range.start,
    endLocal: range.end
  };
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = Number(a[index]) || 0;
    const bv = Number(b[index]) || 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  if (!magA || !magB) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function parseEmbeddingOutput(result) {
  if (!result) {
    return [];
  }

  if (Array.isArray(result)) {
    if (Array.isArray(result[0])) {
      return result;
    }
    return [result];
  }

  if (result.data && Array.isArray(result.dims) && result.dims.length >= 2) {
    const rows = result.dims[0];
    const cols = result.dims[1];
    const vectors = [];

    for (let row = 0; row < rows; row += 1) {
      const start = row * cols;
      const end = start + cols;
      vectors.push(Array.from(result.data.slice(start, end)));
    }

    return vectors;
  }

  if (typeof result.tolist === "function") {
    const values = result.tolist();
    if (Array.isArray(values[0])) {
      return values;
    }
    return [values];
  }

  return [];
}

function normalizeVector(vector) {
  return vector.map((value) => Number(Number(value).toFixed(6)));
}

function buildSessionText(session) {
  const tags = Array.isArray(session.tags) ? session.tags.join(", ") : "";
  return [
    session.title,
    session.description,
    session.track,
    session.type,
    session.speaker,
    session.room,
    session.day,
    session.time,
    tags
  ]
    .filter(Boolean)
    .join(". ");
}

function getCacheKey(eventId) {
  return `${CACHE_PREFIX}${eventId}`;
}

function readEmbeddingCache(eventId, version, sessions) {
  try {
    const raw = localStorage.getItem(getCacheKey(eventId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (parsed.model !== MODEL_ID || parsed.version !== version) {
      return null;
    }

    const ids = sessions.map((item) => String(item.id));
    if (!Array.isArray(parsed.sessionIds) || !Array.isArray(parsed.vectors)) {
      return null;
    }

    if (parsed.sessionIds.length !== ids.length || parsed.vectors.length !== ids.length) {
      return null;
    }

    const exactIds = parsed.sessionIds.every((id, index) => id === ids[index]);
    return exactIds ? parsed.vectors : null;
  } catch {
    return null;
  }
}

function writeEmbeddingCache(eventId, version, sessions, vectors) {
  try {
    localStorage.setItem(getCacheKey(eventId), JSON.stringify({
      model: MODEL_ID,
      version,
      sessionIds: sessions.map((item) => String(item.id)),
      vectors
    }));
  } catch (error) {
    console.warn("Unable to cache agenda embeddings:", error);
  }
}

async function resolveEventVersion(eventId) {
  try {
    const response = await fetch(url(eventDataPath(eventId, "meta.json")));
    if (!response.ok) {
      return "v1";
    }

    const payload = await response.json();
    return String(payload.version || payload.updatedAt || "v1");
  } catch {
    return "v1";
  }
}

async function ensureSessionEmbeddings(eventId, version, sessions) {
  const cachedVectors = readEmbeddingCache(eventId, version, sessions);
  if (cachedVectors) {
    return cachedVectors;
  }

  const embedder = await runQueued(() => getPipe("feature-extraction", MODEL_ID, {
    device: "wasm",
    dtypeWasm: "q8",
    onStatus: setAIStatus
  }));

  const vectors = [];
  for (let index = 0; index < sessions.length; index += BATCH_SIZE) {
    const batch = sessions.slice(index, index + BATCH_SIZE);
    const texts = batch.map((session) => buildSessionText(session));

    const output = await runQueued(() => embedder(texts, {
      pooling: "mean",
      normalize: true
    }));

    const parsedVectors = parseEmbeddingOutput(output);
    parsedVectors.forEach((vector) => {
      vectors.push(normalizeVector(vector));
    });
  }

  writeEmbeddingCache(eventId, version, sessions, vectors);
  return vectors;
}

function toMinutesFromTimeInput(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const parts = text.split(":");
  if (parts.length < 2) {
    return null;
  }

  const hour = toNumber(parts[0], 0);
  const minute = toNumber(parts[1], 0);
  return (hour * 60) + minute;
}

function isWorkshopSession(session) {
  const type = String(session.type || "").toLowerCase();
  return type.includes("workshop");
}

function computePrevCompatible(sortedItems) {
  const prev = new Array(sortedItems.length).fill(-1);

  for (let index = 0; index < sortedItems.length; index += 1) {
    let left = 0;
    let right = index - 1;
    let best = -1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (sortedItems[mid].endAbs <= sortedItems[index].startAbs) {
        best = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    prev[index] = best;
  }

  return prev;
}

function weightedIntervalSchedule(items, maxSessions) {
  if (!items.length) {
    return [];
  }

  const sorted = [...items].sort((a, b) => {
    if (a.endAbs === b.endAbs) {
      return a.startAbs - b.startAbs;
    }
    return a.endAbs - b.endAbs;
  });

  const n = sorted.length;
  const kMax = Math.max(1, maxSessions);
  const prev = computePrevCompatible(sorted);

  const dp = Array.from({ length: n + 1 }, () => new Array(kMax + 1).fill(0));
  const keep = Array.from({ length: n + 1 }, () => new Array(kMax + 1).fill(false));

  for (let i = 1; i <= n; i += 1) {
    const current = sorted[i - 1];
    for (let k = 1; k <= kMax; k += 1) {
      const skip = dp[i - 1][k];
      const prevIndex = prev[i - 1] + 1;
      const take = current.weight + dp[prevIndex][k - 1];

      if (take > skip) {
        dp[i][k] = take;
        keep[i][k] = true;
      } else {
        dp[i][k] = skip;
      }
    }
  }

  let bestK = 1;
  for (let k = 2; k <= kMax; k += 1) {
    if (dp[n][k] > dp[n][bestK]) {
      bestK = k;
    }
  }

  const picked = [];
  let i = n;
  let k = bestK;

  while (i > 0 && k > 0) {
    if (!keep[i][k]) {
      i -= 1;
      continue;
    }

    const selected = sorted[i - 1];
    picked.push(selected);
    i = prev[i - 1] + 1;
    k -= 1;
  }

  picked.sort((a, b) => a.startAbs - b.startAbs);
  return picked;
}

function renderTimeline(container, itinerary) {
  container.innerHTML = "";

  if (!itinerary.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No matching non-overlapping sessions found for your constraints.";
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  itinerary.forEach((session) => {
    const card = document.createElement("article");
    card.className = "session-card";

    const title = document.createElement("h3");
    title.className = "session-title";
    title.textContent = session.title || "Session";

    const meta = document.createElement("div");
    meta.className = "session-meta-list";

    const time = document.createElement("div");
    time.className = "session-meta";
    time.innerHTML = `<span>Time</span><span>${session.day || ""} · ${session.time || "TBA"}</span>`;

    const room = document.createElement("div");
    room.className = "session-meta";
    room.innerHTML = `<span>Room</span><span>${session.room || "TBA"}</span>`;

    const track = document.createElement("div");
    track.className = "session-meta";
    track.innerHTML = `<span>Track</span><span>${session.track || "General"}</span>`;

    meta.append(time, room, track);

    const score = document.createElement("p");
    score.className = "event-card-meta";
    score.textContent = `Match score: ${Number(session.similarity || 0).toFixed(3)}`;

    const desc = document.createElement("p");
    desc.textContent = truncateText(session.description || "", 180);

    card.append(title, meta, score, desc);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

function parseQuestion(value) {
  return truncateText(String(value || "").trim(), 240);
}

function parseMaxSessions(value) {
  const count = toNumber(value, 4);
  return Math.max(1, Math.min(8, Math.floor(count)));
}

function createPlannerRows(sessions, vectors, queryVector, options) {
  const earliest = toMinutesFromTimeInput(options.earliestStart);

  return sessions
    .map((session, index) => {
      const range = getAbsoluteRange(session);
      if (!range) {
        return null;
      }

      if (options.day !== "all" && String(session.day || "") !== options.day) {
        return null;
      }

      if (earliest !== null && range.startLocal < earliest) {
        return null;
      }

      const similarity = cosineSimilarity(queryVector, vectors[index] || []);
      const workshopBonus = options.preferWorkshops && isWorkshopSession(session) ? 0.08 : 0;
      const weight = Math.max(0.0001, similarity + workshopBonus + 1);

      return {
        ...session,
        ...range,
        similarity,
        weight
      };
    })
    .filter(Boolean);
}

async function embedQuestion(question) {
  const embedder = await runQueued(() => getPipe("feature-extraction", MODEL_ID, {
    device: "wasm",
    dtypeWasm: "q8",
    onStatus: setAIStatus
  }));

  const output = await runQueued(() => embedder([question], {
    pooling: "mean",
    normalize: true
  }));

  const vectors = parseEmbeddingOutput(output);
  return vectors.length ? normalizeVector(vectors[0]) : [];
}

export function initAgendaAutopilot({
  eventId,
  sessions,
  saveSessionIds,
  onSaved
}) {
  const panel = document.getElementById("autopilot-panel");
  const timeline = document.getElementById("autopilot-timeline");
  const questionInput = document.getElementById("autopilot-interest");
  const daySelect = document.getElementById("autopilot-day");
  const earliestInput = document.getElementById("autopilot-earliest");
  const maxInput = document.getElementById("autopilot-max");
  const workshopToggle = document.getElementById("autopilot-workshops");
  const buildButton = document.getElementById("autopilot-build");
  const saveAllButton = document.getElementById("autopilot-save-all");
  const status = document.getElementById("autopilot-status");

  if (!panel || !timeline || !questionInput || !buildButton || !saveAllButton) {
    return;
  }

  const dayValues = Array.from(new Set(sessions.map((item) => item.day).filter(Boolean)));
  daySelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All";
  daySelect.appendChild(allOption);
  dayValues.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    daySelect.appendChild(option);
  });

  let itinerary = [];

  function setBusy(isBusy) {
    buildButton.disabled = isBusy;
    buildButton.textContent = isBusy ? "Building..." : "Build my schedule";
  }

  saveAllButton.addEventListener("click", () => {
    if (!itinerary.length) {
      return;
    }

    const ids = itinerary.map((item) => String(item.id));
    saveSessionIds(ids);
    status.textContent = `${ids.length} sessions saved to My Schedule.`;
    if (typeof onSaved === "function") {
      onSaved(ids);
    }
  });

  buildButton.addEventListener("click", async () => {
    const question = parseQuestion(questionInput.value);
    if (!question) {
      status.textContent = "Enter what you are into first.";
      return;
    }

    if (!isAIEnabled()) {
      setAIStatus({ state: "idle", message: "Enable AI to build autopilot schedule." });
      status.textContent = "Enable AI in the navbar first.";
      return;
    }

    try {
      setBusy(true);
      setAIStatus({ state: "loading", message: "Preparing Autopilot..." });
      status.textContent = "Loading model and scoring sessions...";

      const version = await resolveEventVersion(eventId);
      const vectors = await ensureSessionEmbeddings(eventId, version, sessions);
      const queryVector = await embedQuestion(question);

      const rows = createPlannerRows(sessions, vectors, queryVector, {
        day: daySelect.value,
        earliestStart: earliestInput.value,
        maxSessions: parseMaxSessions(maxInput.value),
        preferWorkshops: workshopToggle.checked
      });

      itinerary = weightedIntervalSchedule(rows, parseMaxSessions(maxInput.value));
      renderTimeline(timeline, itinerary);
      saveAllButton.disabled = !itinerary.length;
      status.textContent = itinerary.length
        ? `Built ${itinerary.length} non-overlapping sessions.`
        : "No schedule found for selected constraints.";
      setAIStatus({ state: "ready", message: "Autopilot schedule ready." });
    } catch (error) {
      console.error(error);
      status.textContent = error?.message || "Unable to build schedule right now.";
      setAIStatus({ state: "error", message: "Autopilot failed." });
    } finally {
      setBusy(false);
    }
  });
}
