import { isAIEnabled, setAIEnabled } from "./aiCore.js";
import { setAIStatus } from "./aiStatusUI.js";

const TOGGLE_ID = "ai-enable-toggle";

function buildToggleContent(input) {
  const wrapper = document.createElement("div");
  wrapper.className = "ai-toggle-wrap";

  const label = document.createElement("label");
  label.className = "ai-toggle-label";
  label.setAttribute("for", TOGGLE_ID);

  const text = document.createElement("span");
  text.textContent = "Enable AI";

  label.append(input, text);

  const note = document.createElement("small");
  note.className = "ai-toggle-note";
  note.textContent = "AI runs on your phone, may download a model once.";

  wrapper.append(label, note);
  return wrapper;
}

function onToggleChanged(event) {
  const enabled = Boolean(event.target.checked);
  setAIEnabled(enabled);

  if (enabled) {
    setAIStatus({
      state: "ready",
      message: "AI enabled. Model downloads happen only when needed."
    });
    return;
  }

  setAIStatus({ state: "idle", message: "" });
}

export function initAIEnableToggle() {
  const navList = document.querySelector("nav ul");
  if (!navList || navList.querySelector(`#${TOGGLE_ID}`)) {
    return;
  }

  const input = document.createElement("input");
  input.id = TOGGLE_ID;
  input.type = "checkbox";
  input.checked = isAIEnabled();
  input.addEventListener("change", onToggleChanged);

  const item = document.createElement("li");
  item.className = "ai-toggle-item";
  item.appendChild(buildToggleContent(input));

  navList.appendChild(item);
}
