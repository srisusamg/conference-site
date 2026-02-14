const STORAGE_KEY = "my-schedule";

export function loadSavedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
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

export function persistSavedIds(savedIds) {
  const payload = Array.from(savedIds);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function toggleSavedId(savedIds, sessionId) {
  const key = String(sessionId);
  if (savedIds.has(key)) {
    savedIds.delete(key);
  } else {
    savedIds.add(key);
  }
  persistSavedIds(savedIds);
}
