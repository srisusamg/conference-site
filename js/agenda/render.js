import { sessionAnchorId } from "../shared/anchorIds.js";

function createMetaRow(label, value) {
  const row = document.createElement("div");
  row.className = "session-meta";

  const labelEl = document.createElement("span");
  labelEl.className = "session-meta-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "session-meta-value";
  valueEl.textContent = value || "TBA";

  row.append(labelEl, valueEl);
  return row;
}

export function renderSessions(container, sessions, savedIds, onToggleSave) {
  container.innerHTML = "";

  if (!sessions.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No sessions match your filters yet.";
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  sessions.forEach((session) => {
    const card = document.createElement("article");
    card.className = "session-card";
    card.id = sessionAnchorId(session.id || session.sessionId || session.title);

    const title = document.createElement("h2");
    title.className = "session-title";
    title.textContent = session.title || "Untitled Session";

    const meta = document.createElement("div");
    meta.className = "session-meta-list";
    meta.append(
      createMetaRow("Time", session.time),
      createMetaRow("Track", session.track),
      createMetaRow("Room", session.room),
      createMetaRow("Speaker", session.speaker)
    );

    const actions = document.createElement("div");
    actions.className = "session-actions";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "session-save";

    const isSaved = savedIds.has(String(session.id));
    saveButton.textContent = isSaved ? "Saved" : "Save";
    saveButton.setAttribute("aria-pressed", String(isSaved));

    saveButton.addEventListener("click", () => {
      onToggleSave(session.id);
    });

    actions.appendChild(saveButton);
    card.append(title, meta, actions);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}
