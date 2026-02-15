import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers";

env.allowLocalModels = false;

const pipelineRegistry = new Map();
const AI_ENABLED_KEY = "aiEnabled";
let inferenceQueue = Promise.resolve();

function toBoolean(value) {
  return value === true || value === "true" || value === "1";
}

export function isAIEnabled() {
  return toBoolean(localStorage.getItem(AI_ENABLED_KEY));
}

export function setAIEnabled(enabled) {
  localStorage.setItem(AI_ENABLED_KEY, String(Boolean(enabled)));
}

function getStoredPipeline(task, modelId, device, dtype) {
  const key = JSON.stringify({ task, modelId, device: device || "wasm", dtype: dtype || "default" });
  return {
    key,
    value: pipelineRegistry.get(key)
  };
}

async function hasWebGPU() {
  if (!navigator.gpu || typeof navigator.gpu.requestAdapter !== "function") {
    return false;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

function emitStatus(handler, payload) {
  if (typeof handler === "function") {
    handler(payload);
  }
}

function createProgressCallback(statusHandler) {
  return (event) => {
    if (!event) {
      return;
    }

    const loaded = Number(event.loaded);
    const total = Number(event.total);
    const progress = Number.isFinite(loaded) && Number.isFinite(total) && total > 0
      ? Math.round((loaded / total) * 100)
      : undefined;

    switch (event.status) {
      case "initiate":
        emitStatus(statusHandler, { state: "loading", message: "Loading model…" });
        break;
      case "download":
      case "progress":
        emitStatus(statusHandler, {
          state: "downloading",
          message: typeof progress === "number" ? `Downloading model… ${progress}%` : "Downloading model…"
        });
        break;
      case "done":
        emitStatus(statusHandler, { state: "loading", message: "Finalizing model…" });
        break;
      case "ready":
        emitStatus(statusHandler, { state: "ready", message: "AI model is ready." });
        break;
      default:
        emitStatus(statusHandler, { state: "loading", message: "Loading AI…" });
        break;
    }
  };
}

function resolveDevice(options = {}) {
  const {
    device = "wasm",
    useFasterMode = false,
    useWebGPU = false
  } = options;

  if (device === "webgpu") {
    return "webgpu";
  }

  if (useFasterMode || useWebGPU) {
    return "webgpu";
  }

  return "wasm";
}

async function buildPipeline(task, modelId, options, statusHandler) {
  const args = {
    progress_callback: createProgressCallback(statusHandler)
  };

  if (options.device === "webgpu") {
    args.device = "webgpu";
  }

  if (options.device === "wasm") {
    args.device = "wasm";
  }

  if (options.dtype) {
    args.dtype = options.dtype;
  }

  emitStatus(statusHandler, {
    state: "loading",
    message: options.device === "webgpu" ? "Initializing faster mode…" : "Initializing mobile mode…"
  });

  try {
    return await pipeline(task, modelId, args);
  } catch (error) {
    if (!options.dtype) {
      throw error;
    }

    emitStatus(statusHandler, {
      state: "loading",
      message: "Retrying model load with default precision…"
    });

    const retryArgs = {
      progress_callback: args.progress_callback
    };

    if (options.device === "webgpu") {
      retryArgs.device = "webgpu";
    }

    if (options.device === "wasm") {
      retryArgs.device = "wasm";
    }

    return pipeline(task, modelId, retryArgs);
  }
}

export async function getPipe(task, modelId, options = {}) {
  const {
    device,
    useFasterMode = false,
    useWebGPU = false,
  dtypeWasm = "q8",
  dtypeWebGPU = "fp16",
    onStatus
  } = options;

  const statusHandler = onStatus;

  if (!isAIEnabled()) {
    const error = new Error("AI is disabled. Enable AI from the navbar to load models.");
    emitStatus(statusHandler, { state: "idle", message: "Enable AI to start model loading." });
    throw error;
  }

  let selectedDevice = resolveDevice({ device, useFasterMode, useWebGPU });
  if (selectedDevice === "webgpu" && !(await hasWebGPU())) {
    selectedDevice = "wasm";
  }

  const dtype = selectedDevice === "webgpu" ? dtypeWebGPU : dtypeWasm;

  const cached = getStoredPipeline(task, modelId, selectedDevice, dtype);
  if (cached.value) {
    emitStatus(statusHandler, { state: "ready", message: "AI model is ready." });
    return cached.value;
  }

  const loader = buildPipeline(task, modelId, { device: selectedDevice, dtype }, statusHandler)
    .then((instance) => {
      emitStatus(statusHandler, { state: "ready", message: "AI model is ready." });
      return instance;
    })
    .catch((error) => {
      pipelineRegistry.delete(cached.key);
      emitStatus(statusHandler, {
        state: "error",
        message: error?.message || "Failed to load AI model."
      });
      throw error;
    });

  pipelineRegistry.set(cached.key, loader);
  return loader;
}

export function runQueued(fn) {
  if (typeof fn !== "function") {
    return Promise.reject(new Error("runQueued expects a function."));
  }

  const run = inferenceQueue.then(() => fn());

  inferenceQueue = run
    .catch(() => undefined)
    .then(() => undefined);

  return run;
}

export const getPipeline = getPipe;
