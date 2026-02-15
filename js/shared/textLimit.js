export function truncateText(value, maxChars = 400) {
  const input = typeof value === "string" ? value : String(value ?? "");
  const limit = Number.isFinite(maxChars) ? Math.max(1, Math.floor(maxChars)) : 400;
  return input.length > limit ? input.slice(0, limit) : input;
}
