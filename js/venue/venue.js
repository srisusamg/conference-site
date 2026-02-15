import { url } from "../shared/basePath.js";
import { requireEventId, eventDataPath } from "../eventContext.js";
import { showSkeleton, clearSkeleton, showStatus } from "../shared/renderStates.js";

function renderVenue(container, conference) {
  clearSkeleton(container);
  container.innerHTML = "";

  const card = document.createElement("article");
  card.className = "event-card";

  const venueTitle = document.createElement("h2");
  venueTitle.textContent = conference.venue || "Venue TBA";

  const city = document.createElement("p");
  city.className = "event-card-meta";
  city.textContent = `${conference.city || "City TBA"}, ${conference.state || "State TBA"}`;

  const date = document.createElement("p");
  date.className = "event-card-meta";
  date.textContent = conference.dateRange || "Dates TBA";

  const description = document.createElement("p");
  description.textContent = conference.description || "Venue details will be shared soon.";

  card.append(venueTitle, city, date, description);
  container.appendChild(card);
}

async function initVenue() {
  const container = document.getElementById("venue-info");
  if (!container) {
    return;
  }

  const eventId = requireEventId();
  if (!eventId) {
    return;
  }

  localStorage.setItem("selectedEventId", eventId);

  try {
    container.setAttribute("aria-busy", "true");
    showSkeleton(container, { count: 1 });

    const response = await fetch(url(eventDataPath(eventId, "conference.json")));
    if (!response.ok) {
      throw new Error(`Failed to load venue details: ${response.status}`);
    }

    const conference = await response.json();
    renderVenue(container, conference);
  } catch (error) {
    console.error(error);
    showStatus(container, "Unable to load venue details right now.", "error");
  } finally {
    container.setAttribute("aria-busy", "false");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVenue);
} else {
  initVenue();
}
