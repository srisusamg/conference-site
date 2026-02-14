import { url, withQuery } from "./shared/basePath.js";

function getSelectedState() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("state") || "").trim().toUpperCase();
}

function showMessage(messageContainer, html) {
  messageContainer.hidden = false;
  messageContainer.innerHTML = html;
}

function parseStartDate(event) {
  const direct = String(event.startDate || "").trim();
  const range = String(event.dateRange || "").split(" to ")[0].trim();
  const candidate = direct || range;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";

  const title = document.createElement("h2");
  title.textContent = event.name;

  const meta = document.createElement("p");
  meta.className = "event-card-meta";
  meta.textContent = `${event.city}, ${event.state} • ${event.dateRange || "Dates TBA"}`;

  const details = document.createElement("p");
  details.textContent = event.description || "";

  const tags = document.createElement("p");
  tags.className = "state-card-tags";
  tags.textContent = Array.isArray(event.tags) && event.tags.length
    ? event.tags.join(" • ")
    : "No tags";

  const link = document.createElement("a");
  link.className = "event-card-link";
  link.href = withQuery("pages/event.html", { id: event.id });
  link.textContent = "Open event";

  card.append(title, meta, details, tags, link);
  return card;
}

function buildTagFilters(container, tags, activeTag, onSelect) {
  container.innerHTML = "";

  const all = document.createElement("button");
  all.type = "button";
  all.className = `tag-chip ${activeTag ? "" : "is-active"}`.trim();
  all.textContent = "All";
  all.addEventListener("click", () => onSelect(""));
  container.appendChild(all);

  tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-chip ${activeTag === tag ? "is-active" : ""}`.trim();
    button.textContent = tag;
    button.addEventListener("click", () => onSelect(tag));
    container.appendChild(button);
  });
}

function applyFilters(events, query, activeTag) {
  const normalizedQuery = String(query || "").trim().toLowerCase();

  return events.filter((event) => {
    if (activeTag) {
      const tags = Array.isArray(event.tags) ? event.tags : [];
      if (!tags.includes(activeTag)) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [event.name, event.city, ...(event.tags || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

async function initStatePage() {
  const heading = document.getElementById("state-heading");
  const list = document.getElementById("state-events");
  const message = document.getElementById("state-message");
  const filters = document.getElementById("state-filters");
  const searchInput = document.getElementById("state-search");
  const tagFilters = document.getElementById("state-tag-filters");

  if (!heading || !list || !message || !filters || !searchInput || !tagFilters) {
    return;
  }

  const state = getSelectedState();
  if (!state) {
    heading.textContent = "State not selected";
    showMessage(
      message,
      'Select a state from <a href="../index.html">home</a> to browse Telugu NRI events.'
    );
    list.innerHTML = "";
    return;
  }

  heading.textContent = `Events in ${state}`;

  try {
    const response = await fetch(url("data/events.json"));
    if (!response.ok) {
      throw new Error(`Failed to load events: ${response.status}`);
    }

    const payload = await response.json();
    const allEvents = Array.isArray(payload.events) ? payload.events : [];

    const stateEvents = allEvents
      .filter((event) => String(event.state || "").toUpperCase() === state)
      .sort((a, b) => {
        const dateA = parseStartDate(a);
        const dateB = parseStartDate(b);
        if (!dateA && !dateB) {
          return 0;
        }
        if (!dateA) {
          return 1;
        }
        if (!dateB) {
          return -1;
        }
        return dateA - dateB;
      });

    if (!stateEvents.length) {
      showMessage(
        message,
        `No events found for ${state}. <a href="../index.html">Change state</a>.`
      );
      list.innerHTML = "";
      return;
    }

    message.hidden = true;
    filters.hidden = false;

    const allTags = Array.from(
      new Set(
        stateEvents.flatMap((event) => (Array.isArray(event.tags) ? event.tags : []))
      )
    ).sort((a, b) => a.localeCompare(b));

    const uiState = {
      query: "",
      activeTag: ""
    };

    function render() {
      const filtered = applyFilters(stateEvents, uiState.query, uiState.activeTag);
      list.innerHTML = "";

      if (!filtered.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No events match your filters.";
        list.appendChild(empty);
      } else {
        filtered.forEach((event) => {
          list.appendChild(createEventCard(event));
        });
      }

      buildTagFilters(tagFilters, allTags, uiState.activeTag, (nextTag) => {
        uiState.activeTag = nextTag;
        render();
      });
    }

    searchInput.addEventListener("input", () => {
      uiState.query = searchInput.value;
      render();
    });

    render();
  } catch (error) {
    console.error(error);
    showMessage(message, "Unable to load events right now. Please try again shortly.");
    list.innerHTML = "";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initStatePage);
} else {
  initStatePage();
}
