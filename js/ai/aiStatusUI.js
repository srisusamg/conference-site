import { truncateText } from "../shared/textLimit.js";

let statusRoot;
let statusText;

function ensureStatusRoot() {
  if (statusRoot) {
    return;
  }

  statusRoot = document.createElement("div");
  statusRoot.id = "ai-status-toast";
  statusRoot.className = "ai-status-toast is-idle";
  statusRoot.hidden = true;
  statusRoot.setAttribute("role", "status");
  statusRoot.setAttribute("aria-live", "polite");

  const dot = document.createElement("span");
  dot.className = "ai-status-dot";
  dot.setAttribute("aria-hidden", "true");

  statusText = document.createElement("span");
  statusText.className = "ai-status-text";

  statusRoot.append(dot, statusText);
  document.body.appendChild(statusRoot);
}

function normalizeState(state) {
  const valid = ["idle", "downloading", "loading", "ready", "error"];
  return valid.includes(state) ? state : "idle";
}

export function setAIStatus({ state = "idle", message = "" } = {}) {
  ensureStatusRoot();

  const normalizedState = normalizeState(state);
  statusRoot.className = `ai-status-toast is-${normalizedState}`;

  if (normalizedState === "idle") {
    statusRoot.hidden = true;
    statusText.textContent = "";
    return;
  }

  statusRoot.hidden = false;
  statusText.textContent = truncateText(message || "AI status updated.", 120);

  if (normalizedState === "ready") {
    window.setTimeout(() => {
      if (statusRoot?.classList.contains("is-ready")) {
        statusRoot.hidden = true;
      }
    }, 1800);
  }
}
