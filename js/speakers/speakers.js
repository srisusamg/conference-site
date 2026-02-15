import { url } from "../shared/basePath.js";
import { requireEventId, eventDataPath } from "../eventContext.js";
import { showSkeleton, clearSkeleton, showStatus } from "../shared/renderStates.js";

function renderSpeakers(container, speakers) {
  clearSkeleton(container);
  container.innerHTML = "";

  if (!speakers.length) {
    showStatus(container, "No speakers published for this event yet.", "empty");
    return;
  }

  const fragment = document.createDocumentFragment();

  speakers.forEach((speaker) => {
    const card = document.createElement("article");
    card.className = "speaker-card";

    const name = document.createElement("h2");
    name.className = "speaker-name";
    name.textContent = speaker.name || "Speaker";

    const bio = document.createElement("p");
    bio.className = "speaker-bio";
    bio.textContent = speaker.bio || "Bio coming soon.";

    card.append(name, bio);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

async function initSpeakers() {
  const eventId = requireEventId();
  if (!eventId) {
    return;
  }

  localStorage.setItem("selectedEventId", eventId);

  const container = document.getElementById("speakers");
  if (!container) {
    return;
  }

  try {
    container.setAttribute("aria-busy", "true");
    showSkeleton(container, { count: 3 });

    const response = await fetch(url(eventDataPath(eventId, "speakers.json")));
    if (!response.ok) {
      throw new Error(`Failed to load speakers: ${response.status}`);
    }

    const payload = await response.json();
    renderSpeakers(container, Array.isArray(payload.speakers) ? payload.speakers : []);
  } catch (error) {
    console.error(error);
    showStatus(container, "Unable to load speakers right now.", "error");
  } finally {
    container.setAttribute("aria-busy", "false");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSpeakers);
} else {
  initSpeakers();
}
