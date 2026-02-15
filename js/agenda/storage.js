const LEGACY_STORAGE_KEY = "my-schedule";

function getStorageKey(eventId) {
  if (eventId) {
    return `mySchedule:${eventId}`;
  }
  return LEGACY_STORAGE_KEY;
}

export function loadSavedIds(eventId) {
  try {
    const raw = localStorage.getItem(getStorageKey(eventId));
    if (!raw) {
      if (eventId) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!legacy) {
          return new Set();
        }
        const legacyParsed = JSON.parse(legacy);
        return Array.isArray(legacyParsed) ? new Set(legacyParsed.map(String)) : new Set();
      }
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.map(String));
  } catch (error) {
    console.warn("Failed to load saved sessions:", error);
    return new Set();
  }
}

export function persistSavedIds(savedIds, eventId) {
  const payload = Array.from(savedIds);
  localStorage.setItem(getStorageKey(eventId), JSON.stringify(payload));
}

export function toggleSavedId(savedIds, sessionId, eventId) {
  const key = String(sessionId);
  if (savedIds.has(key)) {
    savedIds.delete(key);
  } else {
    savedIds.add(key);
  }
  persistSavedIds(savedIds, eventId);
}

export function saveManyIds(savedIds, sessionIds, eventId) {
  sessionIds.forEach((sessionId) => {
    savedIds.add(String(sessionId));
  });
  persistSavedIds(savedIds, eventId);
}
