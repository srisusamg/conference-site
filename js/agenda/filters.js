export function buildFilterOptions(sessions) {
  const days = new Set();
  const tracks = new Set();

  sessions.forEach((session) => {
    if (session.day) {
      days.add(session.day);
    }
    if (session.track) {
      tracks.add(session.track);
    }
  });

  return {
    days: Array.from(days).sort(),
    tracks: Array.from(tracks).sort()
  };
}

export function applyFilters(sessions, filters) {
  const dayFilter = filters.day || "all";
  const trackFilter = filters.track || "all";
  const query = (filters.query || "").trim().toLowerCase();
  const onlySaved = Boolean(filters.onlySaved);
  const savedIds = filters.savedIds || new Set();

  return sessions.filter((session) => {
    if (dayFilter !== "all" && session.day !== dayFilter) {
      return false;
    }
    if (trackFilter !== "all" && session.track !== trackFilter) {
      return false;
    }
    if (onlySaved && !savedIds.has(String(session.id))) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      session.title,
      session.speaker,
      session.track,
      session.room,
      session.time,
      session.day
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
