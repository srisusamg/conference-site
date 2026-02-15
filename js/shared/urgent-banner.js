import { loadEventsCatalog, findEventById, getFeaturedEvents } from "./dataLoader.js";
import { getEventContext } from "./eventContext.js";
import { initAIEnableToggle } from "../ai/aiEnableToggle.js";
import { getSelectedEventId } from "../eventContext.js";
import { withQuery } from "./basePath.js";

function enhanceNavigation() {
  const nav = document.querySelector("nav");
  if (!nav) {
    return;
  }

  nav.setAttribute("aria-label", "Primary");
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  nav.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("http")) {
      return;
    }

    let pathName = "";
    try {
      const resolved = new URL(anchor.href, window.location.href);
      pathName = resolved.pathname.split("/").pop() || "";
    } catch {
      return;
    }

    if (pathName && pathName === currentPath) {
      anchor.setAttribute("aria-current", "page");
    } else {
      anchor.removeAttribute("aria-current");
    }
  });
}

function ensureConciergeLink() {
  const navList = document.querySelector("nav ul");
  if (!navList || navList.querySelector("[data-link='concierge']")) {
    return;
  }

  const eventId = getSelectedEventId();
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.dataset.link = "concierge";
  link.textContent = "Concierge";
  link.href = withQuery("concierge.html", eventId ? { id: eventId } : {});
  item.appendChild(link);
  navList.appendChild(item);
}


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

function renderUrgentBanner(announcement) {
  const banner = document.createElement("div");
  banner.className = "urgent-banner";

  const label = document.createElement("span");
  label.className = "urgent-label";
  label.textContent = "Urgent";

  const title = document.createElement("strong");
  title.textContent = announcement.title || "Urgent update";

  const date = document.createElement("span");
  date.className = "urgent-date";
  date.textContent = formatDate(announcement.date);

  const body = document.createElement("span");
  body.className = "urgent-body";
  body.textContent = announcement.body || "";

  banner.append(label, title, date, body);
  document.body.prepend(banner);
}

async function initUrgentBanner() {
  enhanceNavigation();
  initAIEnableToggle();
  ensureConciergeLink();

  try {
    const events = await loadEventsCatalog();
    const context = getEventContext();

    const selectedEvent = findEventById(events, context.eventId);
    const fallbackEvent = getFeaturedEvents(events)[0] || null;
    const activeEvent = selectedEvent || fallbackEvent;

    const announcements = Array.isArray(activeEvent?.announcements) ? activeEvent.announcements : [];
    const urgentItems = announcements.filter((item) => item.urgent === true);
    if (!urgentItems.length) {
      return;
    }
    const [mostRecent] = sortByNewest(urgentItems);
    if (mostRecent) {
      renderUrgentBanner(mostRecent);
    }
  } catch (error) {
    console.warn("Urgent banner unavailable:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUrgentBanner);
} else {
  initUrgentBanner();
}
