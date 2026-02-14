import { loadEventsCatalog, findEventById } from "./shared/dataLoader.js";
import { buildContextLink, getEventContext, setEventContext, applyContextToNav } from "./shared/eventContext.js";

function setLink(id, path) {
  const link = document.getElementById(id);
  if (!link) {
    return;
  }
  link.setAttribute("href", buildContextLink(path));
}

async function initEventGateway() {
  const title = document.getElementById("event-title");
  const meta = document.getElementById("event-meta");
  const description = document.getElementById("event-description");
  const nav = document.querySelector("nav");

  applyContextToNav(nav);

  if (!title || !meta || !description) {
    return;
  }

  try {
    const context = getEventContext();
    const events = await loadEventsCatalog();
    const event = findEventById(events, context.eventId);

    if (!event) {
      title.textContent = "Event not found";
      meta.textContent = "Select a state and event from Home.";
      description.textContent = "";
      return;
    }

    setEventContext({ state: event.state, eventId: event.id });

    title.textContent = event.name;
    meta.textContent = `${event.city}, ${event.state} • ${event.dateRange || "Dates TBA"} • ${event.venue || "Venue TBA"}`;
    description.textContent = event.description || "";

    setLink("goto-agenda", "pages/agenda.html");
    setLink("goto-speakers", "pages/speakers.html");
    setLink("goto-vendors", "pages/vendors.html");
    setLink("goto-announcements", "pages/announcements.html");
  } catch (error) {
    console.error(error);
    title.textContent = "Unable to load event";
    meta.textContent = "Please try again shortly.";
    description.textContent = "";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEventGateway);
} else {
  initEventGateway();
}
