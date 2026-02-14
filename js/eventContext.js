import { withQuery } from "./shared/basePath.js";

const STORAGE_KEY = "selectedEventId";

function clean(value) {
  return String(value || "").trim();
}

export function getSelectedEventId() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = clean(params.get("id"));
  if (fromQuery) {
    return fromQuery;
  }

  const fromStorage = clean(localStorage.getItem(STORAGE_KEY));
  if (fromStorage) {
    return fromStorage;
  }

  return null;
}

export function requireEventId() {
  const eventId = getSelectedEventId();
  if (eventId) {
    return eventId;
  }

  const homeUrl = withQuery("index.html", {
    message: "Please select an event first"
  });
  window.location.href = homeUrl;
  return null;
}

export function eventDataPath(eventId, file) {
  return `data/events/${eventId}/${file}`;
}
