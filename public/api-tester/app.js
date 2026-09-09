const state = {
  routes: [],
  filtered: [],
  selectedIndex: -1
};

const el = {
  countText: document.getElementById("countText"),
  searchInput: document.getElementById("searchInput"),
  methodFilter: document.getElementById("methodFilter"),
  routeList: document.getElementById("routeList"),
  selectedTitle: document.getElementById("selectedTitle"),
  selectedSource: document.getElementById("selectedSource"),
  methodInput: document.getElementById("methodInput"),
  urlInput: document.getElementById("urlInput"),
  headersInput: document.getElementById("headersInput"),
  bodyInput: document.getElementById("bodyInput"),
  sendBtn: document.getElementById("sendBtn"),
  formatBtn: document.getElementById("formatBtn"),
  resultStatus: document.getElementById("resultStatus"),
  resultBody: document.getElementById("resultBody")
};

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (_err) {
    return String(value);
  }
}

function getCurrentRoute() {
  if (state.selectedIndex < 0 || state.selectedIndex >= state.filtered.length) return null;
  return state.filtered[state.selectedIndex];
}

function renderList() {
  el.routeList.innerHTML = "";
  state.filtered.forEach((route, idx) => {
    const div = document.createElement("div");
    div.className = `item${idx === state.selectedIndex ? " active" : ""}`;
    div.innerHTML = `
      <div><span class="badge ${route.method}">${route.method}</span></div>
      <div class="path">${route.path}</div>
      <div class="sub">${route.sourceFile.split("\\\\").slice(-2).join("\\\\")}</div>
    `;
    div.addEventListener("click", () => {
      state.selectedIndex = idx;
      loadSelected();
      renderList();
    });
    el.routeList.appendChild(div);
  });
  el.countText.textContent = `Showing ${state.filtered.length} of ${state.routes.length} APIs`;
}

function applyFilters() {
  const q = el.searchInput.value.trim().toLowerCase();
  const method = el.methodFilter.value;
  state.filtered = state.routes.filter((r) => {
    const okMethod = method === "ALL" || r.method === method;
    const okSearch =
      !q ||
      r.path.toLowerCase().includes(q) ||
      r.sourceFile.toLowerCase().includes(q);
    return okMethod && okSearch;
  });
  state.selectedIndex = state.filtered.length ? 0 : -1;
  renderList();
  loadSelected();
}

function loadSelected() {
  const route = getCurrentRoute();
  if (!route) {
    el.selectedTitle.textContent = "Select an API from left";
    el.selectedSource.textContent = "";
    return;
  }
  el.selectedTitle.textContent = `${route.method} ${route.path}`;
  el.selectedSource.textContent = route.sourceFile;
  el.methodInput.value = route.method;
  el.urlInput.value = `${window.location.origin}${route.path}`;
  el.headersInput.value = '{\n  "content-type": "application/json"\n}';
  el.bodyInput.value = route.sampleBody ? safeStringify(route.sampleBody) : "";
}

function parseJsonInput(text, fallback) {
  if (!text || !text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err.message}`);
  }
}

async function runRequest() {
  try {
    const method = el.methodInput.value;
    const url = el.urlInput.value.trim();
    const headers = parseJsonInput(el.headersInput.value, {});
    const body =
      ["GET", "HEAD"].includes(method) ? null : parseJsonInput(el.bodyInput.value, null);

    el.resultStatus.textContent = "Running...";
    el.resultBody.textContent = "";

    const res = await fetch("/api-tester/api/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, url, headers, body, timeoutMs: 20000 })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      el.resultStatus.textContent = `FAILED ${res.status}`;
      el.resultBody.textContent = safeStringify(data);
      return;
    }

    el.resultStatus.textContent = `${data.status} ${data.ok ? "OK" : "FAIL"} (${data.durationMs} ms)`;
    el.resultBody.textContent = data.responseJson
      ? safeStringify(data.responseJson)
      : String(data.responseText || "");
  } catch (err) {
    el.resultStatus.textContent = "FAILED";
    el.resultBody.textContent = err.message || String(err);
  }
}

function formatJsonAreas() {
  try {
    el.headersInput.value = safeStringify(parseJsonInput(el.headersInput.value, {}));
  } catch (_err) {}
  try {
    const body = parseJsonInput(el.bodyInput.value, null);
    el.bodyInput.value = body == null ? "" : safeStringify(body);
  } catch (_err) {}
}

async function init() {
  const res = await fetch("/api-tester/api/routes");
  const data = await res.json();
  state.routes = data.routes || [];
  state.filtered = [...state.routes];
  state.selectedIndex = state.filtered.length ? 0 : -1;
  renderList();
  loadSelected();
}

el.searchInput.addEventListener("input", applyFilters);
el.methodFilter.addEventListener("change", applyFilters);
el.sendBtn.addEventListener("click", runRequest);
el.formatBtn.addEventListener("click", formatJsonAreas);

init().catch((err) => {
  el.countText.textContent = `Failed to load routes: ${err.message || err}`;
});
