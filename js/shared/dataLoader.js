import { url } from "./basePath.js";

const EVENTS_PATH = "data/events.json";

async function fetchJson(path) {
  const response = await fetch(url(path));
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

function normalizeEvent(event) {
  return {
    ...event,
    id: String(event.id || ""),
    state: String(event.state || "").toUpperCase(),
    speakers: Array.isArray(event.speakers) ? event.speakers : [],
    sessions: Array.isArray(event.sessions) ? event.sessions : [],
    vendors: Array.isArray(event.vendors) ? event.vendors : [],
    announcements: Array.isArray(event.announcements) ? event.announcements : []
  };
}

export async function loadEventsCatalog() {
  const payload = await fetchJson(EVENTS_PATH);
  const events = Array.isArray(payload.events) ? payload.events : [];
  return events.map(normalizeEvent).filter((event) => event.id);
}

export function getStates(events) {
  const states = new Set();
  events.forEach((event) => {
    if (event.state) {
      states.add(event.state);
    }
  });
  return Array.from(states).sort();
}

export function getFeaturedEvents(events, state) {
  return events.filter((event) => {
    if (!event.featured) {
      return false;
    }
    if (!state) {
      return true;
    }
    return event.state === state;
  });
}

export function getEventsByState(events, state) {
  if (!state) {
    return events;
  }
  return events.filter((event) => event.state === state);
}

export function findEventById(events, eventId) {
  const target = String(eventId || "");
  return events.find((event) => event.id === target) || null;
}
