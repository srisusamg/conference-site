export function showSkeleton(container, { count = 3 } = {}) {
  if (!container) {
    return;
  }

  container.innerHTML = "";
  container.classList.add("skeleton-grid");

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < count; index += 1) {
    const item = document.createElement("div");
    item.className = "skeleton-card";
    item.setAttribute("aria-hidden", "true");
    fragment.appendChild(item);
  }

  container.appendChild(fragment);
}

export function clearSkeleton(container) {
  if (!container) {
    return;
  }
  container.classList.remove("skeleton-grid");
}

export function showStatus(container, message, type = "empty") {
  if (!container) {
    return;
  }

  clearSkeleton(container);
  container.innerHTML = "";

  const panel = document.createElement("p");
  panel.className = `status-panel is-${type}`;
  panel.textContent = message;
  panel.setAttribute("role", type === "error" ? "alert" : "status");

  container.appendChild(panel);
}
