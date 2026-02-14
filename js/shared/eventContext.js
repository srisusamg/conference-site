import { withQuery, resolvePath } from "./basePath.js";

const STORAGE_KEY = "conference-event-context";

function clean(value) {
  return String(value || "").trim();
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeStorage(context) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
}

function readUrlContext() {
  const params = new URLSearchParams(window.location.search);
  const state = clean(params.get("state")).toUpperCase();
  const eventId = clean(params.get("event"));
  return {
    state,
    eventId
  };
}

export function getEventContext() {
  const stored = readStorage();
  const fromUrl = readUrlContext();

  const context = {
    state: fromUrl.state || clean(stored.state).toUpperCase(),
    eventId: fromUrl.eventId || clean(stored.eventId)
  };

  if (context.state || context.eventId) {
    writeStorage(context);
  }

  return context;
}

export function setEventContext(nextContext) {
  const context = {
    state: clean(nextContext.state).toUpperCase(),
    eventId: clean(nextContext.eventId)
  };

  writeStorage(context);

  const params = new URLSearchParams(window.location.search);
  if (context.state) {
    params.set("state", context.state);
  } else {
    params.delete("state");
  }

  if (context.eventId) {
    params.set("event", context.eventId);
  } else {
    params.delete("event");
  }

  const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

export function buildContextLink(path, override = {}) {
  const context = getEventContext();
  const params = {
    state: override.state ?? context.state,
    event: override.eventId ?? context.eventId
  };
  return withQuery(path, params);
}

export function applyContextToNav(navElement) {
  if (!navElement) {
    return;
  }

  navElement.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("http") || href.startsWith("#")) {
      return;
    }

    if (!/agenda\.html|speakers\.html|vendors\.html|announcements\.html|event\.html|state\.html/.test(href)) {
      return;
    }

    const normalized = href.startsWith("../") ? href.slice(3) : href;
    const target = href.startsWith("../") ? `pages/${normalized}` : `pages/${normalized}`;
    const next = buildContextLink(target);
    anchor.setAttribute("href", next);
  });
}

export function requireEventContext(options = {}) {
  const context = getEventContext();
  if (context.eventId) {
    return context;
  }

  const fallback = options.redirectPath || "index.html";
  window.location.href = resolvePath(fallback);
  return null;
}
