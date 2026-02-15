function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sessionAnchorId(id) {
  const token = normalize(id) || "item";
  return `session-${token}`;
}

export function vendorAnchorId(id) {
  const token = normalize(id) || "item";
  return `vendor-${token}`;
}

export function announcementAnchorId(id) {
  const token = normalize(id) || "item";
  return `announcement-${token}`;
}
