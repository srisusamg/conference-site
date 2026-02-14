import { url, withQuery } from "./shared/basePath.js";
import { eventDataPath, requireEventId } from "./eventContext.js";

function setActionLinks(eventId) {
  const links = [
    ["goto-agenda", "pages/agenda.html"],
    ["goto-speakers", "pages/speakers.html"],
    ["goto-vendors", "pages/vendors.html"],
    ["goto-announcements", "pages/announcements.html"],
    ["goto-venue", "pages/venue.html"]
  ];

  links.forEach(([id, path]) => {
    const anchor = document.getElementById(id);
    if (!anchor) {
      return;
    }
    anchor.href = withQuery(path, { id: eventId });
  });
}

function showMessage(container, text) {
  container.hidden = false;
  container.textContent = text;
}

async function fetchJson(path) {
  const response = await fetch(url(path));
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function applyHero(conference, fallbackEvent) {
  const title = document.getElementById("event-title");
  const date = document.getElementById("event-date");
  const location = document.getElementById("event-location");
  const description = document.getElementById("event-description");

  const name = conference?.name || fallbackEvent?.name || "Event";
  const dateRange = conference?.dateRange || fallbackEvent?.dateRange || "Dates TBA";
  const city = conference?.city || fallbackEvent?.city || "City TBA";
  const venue = conference?.venue || fallbackEvent?.venue || "Venue TBA";
  const desc = conference?.description || fallbackEvent?.description || "";

  title.textContent = name;
  date.textContent = dateRange;
  location.textContent = `${city} • ${venue}`;
  description.textContent = desc;
}

async function initEventPage() {
  const message = document.getElementById("event-message");
  if (!message) {
    return;
  }

  const eventId = requireEventId();
  if (!eventId) {
    return;
  }

  localStorage.setItem("selectedEventId", eventId);
  setActionLinks(eventId);

  try {
    const [conference, catalog] = await Promise.all([
      fetchJson(eventDataPath(eventId, "conference.json")),
      fetchJson("data/events.json")
    ]);

    const fallbackEvent = Array.isArray(catalog?.events)
      ? catalog.events.find((item) => item.id === eventId)
      : null;

    applyHero(conference, fallbackEvent);
  } catch (error) {
    console.error(error);
    showMessage(message, "Unable to load this event right now. Please choose another event from home.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEventPage);
} else {
  initEventPage();
}
