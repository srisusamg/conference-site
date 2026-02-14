function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortByNewest(items) {
  return [...items].sort((a, b) => {
    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);
    if (!dateA && !dateB) {
      return 0;
    }
    if (!dateA) {
      return 1;
    }
    if (!dateB) {
      return -1;
    }
    return dateB - dateA;
  });
}

function formatDate(value) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "";
  }
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function renderAnnouncements(container, items) {
  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No announcements yet.";
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "announcement-card";

    const date = document.createElement("p");
    date.className = "announcement-date";
    date.textContent = formatDate(item.date);

    const title = document.createElement("h2");
    title.className = "announcement-title";
    title.textContent = item.title || "Update";

    const body = document.createElement("p");
    body.className = "announcement-body";
    body.textContent = item.body || "";

    card.append(date, title, body);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

async function loadAnnouncements() {
  const response = await fetch("/data/announcements.json");
  if (!response.ok) {
    throw new Error(`Failed to load announcements: ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload.announcements) ? payload.announcements : [];
}

async function initAnnouncements() {
  const list = document.getElementById("announcement-list");
  if (!list) {
    return;
  }

  try {
    const announcements = await loadAnnouncements();
    const sorted = sortByNewest(announcements);
    renderAnnouncements(list, sorted);
  } catch (error) {
    console.error(error);
    list.textContent = "Unable to load announcements right now.";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAnnouncements);
} else {
  initAnnouncements();
}
