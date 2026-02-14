import { url, withQuery } from "./basePath.js";
import { getSelectedEventId, eventDataPath } from "../eventContext.js";

async function fetchJson(path) {
  const response = await fetch(url(path));
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function getEventName(eventId) {
  try {
    const conference = await fetchJson(eventDataPath(eventId, "conference.json"));
    if (conference?.name) {
      return conference.name;
    }
  } catch {
  }

  try {
    const eventsPayload = await fetchJson("data/events.json");
    const events = Array.isArray(eventsPayload?.events) ? eventsPayload.events : [];
    return events.find((event) => event.id === eventId)?.name || "Selected Event";
  } catch {
    return "Selected Event";
  }
}

export async function initSelectedEventBanner() {
  const container = document.getElementById("selected-event-banner");
  if (!container) {
    return;
  }

  const eventId = getSelectedEventId();
  if (!eventId) {
    container.hidden = true;
    return;
  }

  const name = await getEventName(eventId);
  const switchLink = withQuery("index.html", { message: "Choose another event" });

  container.innerHTML = "";
  const label = document.createElement("span");
  label.className = "selected-event-label";
  label.textContent = "Selected event:";

  const title = document.createElement("strong");
  title.className = "selected-event-name";
  title.textContent = name;

  const link = document.createElement("a");
  link.className = "selected-event-switch";
  link.href = switchLink;
  link.textContent = "Switch event";

  container.append(label, title, link);
  container.hidden = false;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSelectedEventBanner);
} else {
  initSelectedEventBanner();
}
