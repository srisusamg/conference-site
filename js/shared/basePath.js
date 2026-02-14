function normalizePath(value) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function isFileProtocol() {
  return window.location.protocol === "file:";
}

function getFilePrefix() {
  const pathname = normalizePath(window.location.pathname);
  return pathname.includes("/pages/") ? "../" : "";
}

export function getBasePath() {
  if (isFileProtocol()) {
    return "";
  }

  const pathname = normalizePath(window.location.pathname);
  const host = window.location.hostname;

  if (host === "localhost" || host === "127.0.0.1") {
    return "";
  }

  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) {
    return "";
  }

  const last = parts[parts.length - 1] || "";
  if (last.includes(".")) {
    parts.pop();
  }

  if (parts[parts.length - 1] === "pages") {
    parts.pop();
  }

  return parts.length ? `/${parts[0]}` : "";
}

export function resolvePath(path) {
  const clean = trimSlashes(path);

  if (isFileProtocol()) {
    if (!clean) {
      return getFilePrefix() || "./";
    }
    return `${getFilePrefix()}${clean}`;
  }

  const basePath = getBasePath();
  if (!clean) {
    return basePath || "/";
  }
  return basePath ? `${basePath}/${clean}` : `/${clean}`;
}

export function url(path) {
  return resolvePath(path);
}

export function withQuery(path, params = {}) {
  if (isFileProtocol()) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      query.set(key, value);
    });

    const base = resolvePath(path);
    const suffix = query.toString();
    return suffix ? `${base}?${suffix}` : base;
  }

  const target = new URL(resolvePath(path), window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    target.searchParams.set(key, value);
  });
  return `${target.pathname}${target.search}`;
}
