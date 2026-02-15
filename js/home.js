import { url, withQuery } from "./shared/basePath.js";
import { setEventContext } from "./shared/eventContext.js";
import { showSkeleton, clearSkeleton, showStatus } from "./shared/renderStates.js";

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";

  const title = document.createElement("h3");
  title.textContent = event.name;

  const meta = document.createElement("p");
  meta.className = "event-card-meta";
  meta.textContent = `${event.city}, ${event.state} • ${event.dateRange || "Dates TBA"}`;

  const description = document.createElement("p");
  description.textContent = event.description || "";

  const link = document.createElement("a");
  link.className = "event-card-link";
  link.href = withQuery("pages/event.html", { id: event.id });
  link.textContent = "View event";
  link.addEventListener("click", () => {
    setEventContext({ state: event.state, eventId: event.id });
  });

  card.append(title, meta, description, link);
  return card;
}

function normalizeEvents(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  return events.map((event) => ({
    ...event,
    state: String(event.state || "").toUpperCase(),
    tags: Array.isArray(event.tags) ? event.tags : [],
    popularityScore: Number(event.popularityScore || 0)
  }));
}

function getStates(events) {
  const states = new Set();
  events.forEach((event) => {
    if (event.state) {
      states.add(event.state);
    }
  });
  return Array.from(states).sort();
}

function getTopFeaturedEvents(events) {
  return events
    .filter((event) => event.featured === true)
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 2);
}

function applySearch(events, query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) {
    return events;
  }

  return events.filter((event) => {
    const haystack = [event.name, event.city, ...(event.tags || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(text);
  });
}

async function initHome() {
  const stateSelect = document.getElementById("state-selector");
  const featuredList = document.getElementById("featured-events");
  const browseButton = document.getElementById("browse-state-events");
  const searchInput = document.getElementById("event-search");

  if (!stateSelect || !featuredList || !browseButton || !searchInput) {
    return;
  }

  try {
    featuredList.setAttribute("aria-busy", "true");
    showSkeleton(featuredList, { count: 2 });

    const response = await fetch(url("data/events.json"));
    if (!response.ok) {
      throw new Error(`Failed to load events: ${response.status}`);
    }

    const payload = await response.json();
    const events = normalizeEvents(payload);
    const states = getStates(events);
    const featuredEvents = getTopFeaturedEvents(events);

    stateSelect.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select a state";
    stateSelect.appendChild(defaultOption);

    states.forEach((state) => {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      stateSelect.appendChild(option);
    });

    function renderCards() {
      clearSkeleton(featuredList);
      const visible = applySearch(featuredEvents, searchInput.value);
      featuredList.innerHTML = "";

      if (!visible.length) {
        showStatus(featuredList, "No popular events match your search.", "empty");
        return;
      }

      visible.forEach((event) => {
        featuredList.appendChild(createEventCard(event));
      });
    }

    function updateBrowseState() {
      const selectedState = stateSelect.value;
      browseButton.disabled = !selectedState;
      if (selectedState) {
        setEventContext({ state: selectedState, eventId: "" });
      }
    }

    browseButton.addEventListener("click", () => {
      const selectedState = stateSelect.value;
      if (!selectedState) {
        return;
      }
      const next = withQuery("pages/state.html", { state: selectedState });
      window.location.href = next;
    });

    stateSelect.addEventListener("change", updateBrowseState);
    searchInput.addEventListener("input", renderCards);

    updateBrowseState();
    renderCards();
  } catch (error) {
    console.error(error);
    showStatus(featuredList, "Unable to load featured events right now.", "error");
  } finally {
    featuredList.setAttribute("aria-busy", "false");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHome);
} else {
  initHome();
}
