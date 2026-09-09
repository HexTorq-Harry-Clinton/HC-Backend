#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_RETRIES = 1;

function parseArgs(argv) {
  const args = {
    mode: "safe",
    source: "js",
    rootDir: path.join(process.cwd(), "routes", "HARRY_CLINTON"),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    concurrency: DEFAULT_CONCURRENCY,
    intervalMs: DEFAULT_INTERVAL_MS,
    retries: DEFAULT_RETRIES,
    autoFix: true,
    maxRequests: null,
    baseUrl:
      process.env.API_BASE_URL || "http://localhost:15000/API/HARRY-CLINTON",
    vars: {}
  };

  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === "--help" || current === "-h") {
      args.help = true;
      continue;
    }
    if (current === "--mode" && next) {
      args.mode = next.toLowerCase();
      i += 1;
      continue;
    }
    if (current === "--source" && next) {
      args.source = next.toLowerCase();
      i += 1;
      continue;
    }
    if (current === "--rootDir" && next) {
      args.rootDir = path.resolve(next);
      i += 1;
      continue;
    }
    if (current === "--baseUrl" && next) {
      args.baseUrl = next;
      i += 1;
      continue;
    }
    if (current === "--timeoutMs" && next) {
      args.timeoutMs = Number(next) || DEFAULT_TIMEOUT_MS;
      i += 1;
      continue;
    }
    if (current === "--concurrency" && next) {
      args.concurrency = Number(next) || DEFAULT_CONCURRENCY;
      i += 1;
      continue;
    }
    if (current === "--intervalMs" && next) {
      args.intervalMs = Number(next) || DEFAULT_INTERVAL_MS;
      i += 1;
      continue;
    }
    if (current === "--retries" && next) {
      args.retries = Number(next) || DEFAULT_RETRIES;
      i += 1;
      continue;
    }
    if (current === "--autoFix" && next) {
      args.autoFix = String(next).toLowerCase() !== "false";
      i += 1;
      continue;
    }
    if (current === "--maxRequests" && next) {
      args.maxRequests = Number(next) || null;
      i += 1;
      continue;
    }
    if (current === "--var" && next) {
      const [k, ...v] = next.split("=");
      if (k && v.length > 0) args.vars[k.trim()] = v.join("=").trim();
      i += 1;
      continue;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Route Analytics Runner

Usage:
  node scripts/route-analytics-runner.js [options]

Options:
  --source js|json        request source type (default: js)
  --mode safe|full        safe = only GET/HEAD/OPTIONS, full = all methods
  --baseUrl URL           API base URL
  --rootDir PATH          Route root (default: routes/HARRY_CLINTON)
  --timeoutMs N           Request timeout in ms (default: 15000)
  --concurrency N         Parallel workers (default: 1)
  --intervalMs N          Delay between calls per worker (default: 1000)
  --retries N             Retry attempts when auto-fix is applied (default: 1)
  --autoFix true|false    Auto repair failed payloads (default: true)
  --maxRequests N         Run only first N requests
  --var KEY=VALUE         Template vars, e.g. --var review_id=rev_001
  --help                  Show this help

Examples:
  node scripts/route-analytics-runner.js --source js --mode full --intervalMs 1000
  node scripts/route-analytics-runner.js --source js --mode full --retries 2 --autoFix true
  `.trim());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function walkJsonFiles(dirPath) {
  const out = [];
  if (!fs.existsSync(dirPath)) return out;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJsonFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      out.push(fullPath);
    }
  }
  return out;
}

function normalizeRoutePath(p) {
  if (!p) return "/";
  let out = p.trim();
  if (!out.startsWith("/")) out = "/" + out;
  out = out.replace(/\/{2,}/g, "/");
  return out;
}

function normalizeJoinedPath(a, b) {
  const left = normalizeRoutePath(a).replace(/\/$/, "");
  const right = normalizeRoutePath(b);
  const out = `${left}${right}`.replace(/\/{2,}/g, "/");
  return out || "/";
}

function stripTrailingSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_err) {
    return null;
  }
}

function flattenCollections(collection, sourceFile, parentName = "") {
  const out = [];
  const collectionName = [parentName, collection.name].filter(Boolean).join(" / ");
  const requests = Array.isArray(collection.requests) ? collection.requests : [];

  for (const req of requests) {
    out.push({
      sourceFile,
      collectionName,
      requestName: req.name || "(unnamed)",
      method: String(req.method || "GET").toUpperCase(),
      url: req.url || "",
      urlPath: "",
      headers: Array.isArray(req.headers) ? req.headers : [],
      body: req.body || { type: "none" }
    });
  }

  const children = Array.isArray(collection.collections) ? collection.collections : [];
  for (const child of children) out.push(...flattenCollections(child, sourceFile, collectionName));
  return out;
}

function extractHttpieRequests(doc, sourceFile) {
  if (!doc || typeof doc !== "object" || !doc.entry) return [];
  const entry = doc.entry;

  if (Array.isArray(entry.requests)) {
    return flattenCollections(
      { name: entry.name || "Collection", requests: entry.requests },
      sourceFile
    );
  }
  if (Array.isArray(entry.collections)) {
    const out = [];
    for (const collection of entry.collections) {
      out.push(...flattenCollections(collection, sourceFile, entry.name || "Workspace"));
    }
    return out;
  }
  return [];
}

function parseMountsFromIndex(indexPath) {
  const mounts = [];
  if (!fs.existsSync(indexPath)) return mounts;
  const text = fs.readFileSync(indexPath, "utf8");
  const rx =
    /router\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*require\(\s*['"`](\.\/[^'"`]+)['"`]\s*\)\s*\)/g;
  let match = rx.exec(text);
  while (match) {
    mounts.push({
      mountPath: normalizeRoutePath(match[1]),
      requirePath: match[2]
    });
    match = rx.exec(text);
  }
  return mounts;
}

function resolveRouteFile(rootDir, requirePath) {
  const noDot = requirePath.replace(/^\.\//, "");
  const asJs = path.join(rootDir, `${noDot}.js`);
  if (fs.existsSync(asJs)) return asJs;
  const asIndex = path.join(rootDir, noDot, "index.js");
  if (fs.existsSync(asIndex)) return asIndex;
  const asRaw = path.join(rootDir, noDot);
  if (fs.existsSync(asRaw)) return asRaw;
  return null;
}

function extractRequestsFromRouteJs(routeFile, mountPath) {
  const out = [];
  if (!fs.existsSync(routeFile)) return out;
  const text = fs.readFileSync(routeFile, "utf8");
  const rx = /router\.(get|post|put|delete|patch|head|options)\s*\(\s*(['"`])([^'"`]+)\2/gi;
  let match = rx.exec(text);
  while (match) {
    const method = String(match[1] || "").toUpperCase();
    const localPath = normalizeRoutePath(match[3]);
    out.push({
      sourceFile: routeFile,
      collectionName: mountPath,
      requestName: `${method} ${normalizeJoinedPath(mountPath, localPath)}`,
      method,
      url: "",
      urlPath: normalizeJoinedPath(mountPath, localPath),
      headers: [],
      body: { type: "none" }
    });
    match = rx.exec(text);
  }
  return out;
}

function discoverJsRequests(rootDir) {
  const indexPath = path.join(rootDir, "index.js");
  const mounts = parseMountsFromIndex(indexPath);
  const all = [];
  for (const mount of mounts) {
    const routeFile = resolveRouteFile(rootDir, mount.requirePath);
    if (!routeFile) continue;
    all.push(...extractRequestsFromRouteJs(routeFile, mount.mountPath));
  }
  return all;
}

function headersToObject(headers) {
  const out = {};
  for (const h of headers) {
    if (h && h.enabled !== false && h.name) out[h.name] = String(h.value || "");
  }
  return out;
}

function buildRequestPayload(item, overrideBody) {
  if (overrideBody && typeof overrideBody === "object") {
    return {
      skip: false,
      payload: JSON.stringify(overrideBody),
      headers: { "content-type": "application/json" }
    };
  }

  const body = item.body || {};
  if (!body.type || body.type === "none") return { skip: false, payload: null, headers: {} };

  if (body.type === "text") {
    const textValue = body.text && typeof body.text.value === "string" ? body.text.value : "";
    const format = body.text && body.text.format ? String(body.text.format).toLowerCase() : "";
    const headers = {};
    if (format.includes("json")) headers["content-type"] = "application/json";
    else if (format) headers["content-type"] = format;
    return { skip: false, payload: textValue, headers };
  }

  if (body.type === "form") {
    const form = body.form || {};
    if (form.isMultipart) return { skip: true, reason: "multipart form-data is not supported" };
    const fields = Array.isArray(form.fields) ? form.fields : [];
    const params = new URLSearchParams();
    for (const f of fields) {
      if (!f || f.enabled === false || !f.name) continue;
      if (f.type === "file") return { skip: true, reason: "file upload not supported" };
      params.append(f.name, f.value == null ? "" : String(f.value));
    }
    return {
      skip: false,
      payload: params.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded" }
    };
  }

  if (body.type === "file") return { skip: true, reason: "raw file body is not supported" };
  return { skip: true, reason: `unsupported body type: ${body.type}` };
}

function toSamplePath(routePath, vars) {
  return String(routePath || "/").replace(/:([A-Za-z0-9_]+)/g, (_m, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return encodeURIComponent(String(vars[key]));
    }
    return `${key}_sample`;
  });
}

function safeJsonParse(input) {
  try {
    return JSON.parse(input);
  } catch (_err) {
    return null;
  }
}

function toPreviewBody(payload) {
  if (payload == null) return null;
  if (typeof payload === "string") return payload.slice(0, 500);
  return JSON.stringify(payload).slice(0, 500);
}

function nowTs() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function extractErrorMessage(attempt) {
  if (!attempt) return "";
  if (attempt.error) return String(attempt.error);
  const parsed = safeJsonParse(attempt.responseBody || "");
  if (parsed && typeof parsed === "object") {
    if (typeof parsed.message === "string") return parsed.message;
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.details === "string") return parsed.details;
  }
  return String(attempt.responseBody || "").slice(0, 500);
}

function unique(arr) {
  return [...new Set(arr)];
}

function tokenizeFieldCandidates(text) {
  const tokens = String(text || "").match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const stop = new Set([
    "required",
    "field",
    "fields",
    "is",
    "are",
    "the",
    "and",
    "or",
    "must",
    "be",
    "missing",
    "data",
    "body"
  ]);
  return unique(tokens.filter((t) => !stop.has(t.toLowerCase())));
}

function extractMissingFieldsFromMessage(message) {
  const msg = String(message || "");
  const out = [];
  const patterns = [
    /required\s+fields?\s+missing\s*\(([^)]+)\)/i,
    /missing(?:\s+required)?\s+fields?\s*:?\s*([A-Za-z0-9_,\s]+)/i,
    /([A-Za-z0-9_,\s]+)\s+required/i,
    /required\s*:?\s*([A-Za-z0-9_,\s]+)/i
  ];
  for (const rx of patterns) {
    const match = rx.exec(msg);
    if (match && match[1]) {
      out.push(...tokenizeFieldCandidates(match[1]));
    }
  }
  return unique(out);
}

function parseConstFieldArray(fileText, constName) {
  const rx = new RegExp(
    `const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`,
    "i"
  );
  const m = rx.exec(fileText);
  if (!m || !m[1]) return [];
  const inner = m[1];
  const fields = [];
  const tokenRx = /['"`]([A-Za-z0-9_]+)['"`]/g;
  let t = tokenRx.exec(inner);
  while (t) {
    fields.push(t[1]);
    t = tokenRx.exec(inner);
  }
  return unique(fields);
}

function defaultValueForField(field) {
  const f = String(field || "").toLowerCase();
  if (f === "rcu" || f === "luu" || f.endsWith("_by")) return "AUTO_RUNNER";
  if (f.includes("email")) return "autobot@example.com";
  if (f.includes("password")) return "Pass@123456";
  if (f.includes("mobile") || f.includes("phone")) return "9999999999";
  if (f.includes("otp")) return "123456";
  if (f.includes("date") || f.includes("time")) return new Date().toISOString();
  if (f.startsWith("is_") || f.startsWith("has_")) return false;
  if (f.includes("rating")) return 4;
  if (f.includes("qty") || f.includes("count") || f.includes("total")) return 1;
  if (f.includes("price") || f.includes("amount") || f.includes("cost")) return 10;
  if (f.endsWith("_id") || f === "id") return `${f}_001`;
  return `${f}_sample`;
}

function inferFieldsFromRouteSource(item) {
  if (!item.sourceFile || !fs.existsSync(item.sourceFile)) return [];
  const text = fs.readFileSync(item.sourceFile, "utf8");
  const method = String(item.method || "").toLowerCase();

  const startRx = new RegExp(`router\\.${method}\\s*\\(`, "i");
  const startMatch = startRx.exec(text);
  const blockText = startMatch ? text.slice(startMatch.index, startMatch.index + 2800) : text;

  const fields = [];
  const patterns = [
    /!data\.([A-Za-z0-9_]+)/g,
    /req\.body\.([A-Za-z0-9_]+)/g,
    /["'`]([A-Za-z0-9_]+)["'`]\s+required/gi
  ];
  for (const rx of patterns) {
    let m = rx.exec(blockText);
    while (m) {
      fields.push(m[1]);
      m = rx.exec(blockText);
    }
  }

  const pathParamMatches = String(item.urlPath || "").match(/:([A-Za-z0-9_]+)/g) || [];
  for (const token of pathParamMatches) fields.push(token.slice(1));

  const bodyDestructure = /{([^}]+)}\s*=\s*req\.body/gi;
  let dm = bodyDestructure.exec(blockText);
  while (dm) {
    const names = dm[1]
      .split(",")
      .map((s) => s.trim().replace(/=.*$/, "").replace(/\s+/g, ""))
      .filter(Boolean);
    fields.push(...names);
    dm = bodyDestructure.exec(blockText);
  }

  if (method === "post") fields.push(...parseConstFieldArray(text, "INSERT_FIELDS"));
  if (method === "put" || method === "patch") {
    fields.push(...parseConstFieldArray(text, "UPDATE_FIELDS"));
  }
  if (method === "delete") {
    fields.push(...parseConstFieldArray(text, "UPDATE_FIELDS"));
    const deleteBodyMatch = text.match(/Body:\s*\{([^}]+)\}/i);
    if (deleteBodyMatch && deleteBodyMatch[1]) {
      fields.push(...tokenizeFieldCandidates(deleteBodyMatch[1]));
    }
  }

  return unique(fields);
}

function buildHeuristicPayload(item, missingFields) {
  const fields =
    missingFields && missingFields.length ? missingFields : inferFieldsFromRouteSource(item);
  if (!fields.length) return null;

  const body = {};
  for (const field of fields) body[field] = defaultValueForField(field);
  return body;
}

function mergeIdPool(body, idPool) {
  if (!body || typeof body !== "object") return body;
  const merged = { ...body };
  for (const key of Object.keys(merged)) {
    if (merged[key] != null && String(merged[key]).trim() !== "") continue;
    if (idPool && Object.prototype.hasOwnProperty.call(idPool, key)) {
      merged[key] = idPool[key];
    }
  }

  for (const key of Object.keys(merged)) {
    if (
      typeof merged[key] === "string" &&
      merged[key].endsWith("_001") &&
      idPool &&
      Object.prototype.hasOwnProperty.call(idPool, key)
    ) {
      merged[key] = idPool[key];
    }
  }
  return merged;
}

function extractIdsFromPayload(payload) {
  const ids = {};
  if (!payload || typeof payload !== "object") return ids;
  for (const [k, v] of Object.entries(payload)) {
    if (v == null) continue;
    if (k === "id" || k.endsWith("_id")) ids[k] = v;
  }
  return ids;
}

function captureIdsFromResponse(result, runtime) {
  if (!runtime || !runtime.idPool || !result || !result.ok) return;
  const parsed = safeJsonParse(result.responseBody || "");
  if (!parsed || typeof parsed !== "object") return;

  const candidates = [];
  if (parsed.data && typeof parsed.data === "object") {
    if (Array.isArray(parsed.data)) {
      if (parsed.data[0] && typeof parsed.data[0] === "object") candidates.push(parsed.data[0]);
    } else {
      candidates.push(parsed.data);
    }
  } else {
    candidates.push(parsed);
  }

  for (const c of candidates) {
    const ids = extractIdsFromPayload(c);
    for (const [k, v] of Object.entries(ids)) runtime.idPool[k] = v;
  }
}

function applyPathParamsFromContext(url, vars, runtime) {
  const idPool = runtime && runtime.idPool ? runtime.idPool : {};
  const replaceInPath = (inputPath) =>
    String(inputPath || "").replace(/:([A-Za-z0-9_]+)/g, (_m, key) => {
      if (Object.prototype.hasOwnProperty.call(vars || {}, key)) {
        return encodeURIComponent(String(vars[key]));
      }
      if (Object.prototype.hasOwnProperty.call(idPool, key)) {
        return encodeURIComponent(String(idPool[key]));
      }
      if (key === "id") {
        const fallback = idPool.user_id || idPool.role_id || idPool.product_id || "id_sample";
        return encodeURIComponent(String(fallback));
      }
      return `${key}_sample`;
    });

  const raw = String(url || "");
  try {
    const parsed = new URL(raw);
    parsed.pathname = replaceInPath(parsed.pathname);
    return parsed.toString();
  } catch (_err) {
    // Fallback for relative/invalid URLs.
    return replaceInPath(raw);
  }
}

async function executeAttempt(item, opts, overrideBody, fixNote, attemptNo) {
  const method = String(item.method || "GET").toUpperCase();
  if (opts.mode !== "full" && !SAFE_METHODS.has(method)) {
    return {
      skipped: true,
      skipReason: `blocked by mode=safe (${method})`,
      attemptNo
    };
  }

  const payloadMeta = buildRequestPayload(item, overrideBody);
  if (payloadMeta.skip) {
    return {
      skipped: true,
      skipReason: payloadMeta.reason,
      attemptNo
    };
  }

  const rawUrl =
    item.url ||
    `${stripTrailingSlash(opts.baseUrl)}${toSamplePath(item.urlPath || "/", opts.vars || {})}`;
  const fullUrl = applyPathParamsFromContext(rawUrl, opts.vars || {}, opts.runtime || {});
  const mergedHeaders = {
    ...headersToObject(item.headers || []),
    ...payloadMeta.headers
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
  const start = process.hrtime.bigint();
  try {
    const response = await fetch(fullUrl, {
      method,
      headers: mergedHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : payloadMeta.payload,
      signal: controller.signal
    });

    const responseBody = await response.text();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    return {
      skipped: false,
      attemptNo,
      fixNote: fixNote || null,
      request: {
        method,
        url: fullUrl,
        headers: mergedHeaders,
        bodyPreview: toPreviewBody(payloadMeta.payload)
      },
      status: response.status,
      ok: response.ok,
      durationMs: Number(durationMs.toFixed(2)),
      responseBody,
      responseBytes: Buffer.byteLength(responseBody, "utf8")
    };
  } catch (err) {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    return {
      skipped: false,
      attemptNo,
      fixNote: fixNote || null,
      request: {
        method,
        url: fullUrl,
        headers: mergedHeaders,
        bodyPreview: toPreviewBody(payloadMeta.payload)
      },
      status: 0,
      ok: false,
      durationMs: Number(durationMs.toFixed(2)),
      responseBody: "",
      responseBytes: 0,
      error: err && err.message ? err.message : String(err)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldTryFix(attempt) {
  if (!attempt || attempt.skipped || attempt.ok) return false;
  const msg = extractErrorMessage(attempt).toLowerCase();
  if (attempt.status === 405 && msg.includes("required fields missing")) return true;
  if (attempt.status === 400 || attempt.status === 422 || attempt.status === 500 || attempt.status === 0) {
    return true;
  }
  return false;
}

async function executeWithAutoFix(item, opts) {
  const attempts = [];
  let seedBody = null;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(String(item.method || "").toUpperCase())) {
    seedBody = mergeIdPool(buildHeuristicPayload(item, []), opts.runtime ? opts.runtime.idPool : {});
  }

  const first = await executeAttempt(
    item,
    opts,
    seedBody,
    seedBody ? `seedBody: ${Object.keys(seedBody).join(", ")}` : null,
    1
  );
  attempts.push(first);
  captureIdsFromResponse(first, opts.runtime);

  if (first.skipped || first.ok || !opts.autoFix || opts.retries <= 0 || !shouldTryFix(first)) {
    return finalizeResult(item, attempts);
  }

  let retryCount = 0;
  let latest = first;

  while (retryCount < opts.retries && !latest.ok && !latest.skipped) {
    const errMsg = extractErrorMessage(latest);
    const missingFields = extractMissingFieldsFromMessage(errMsg);
    const fixBody = mergeIdPool(
      buildHeuristicPayload(item, missingFields),
      opts.runtime ? opts.runtime.idPool : {}
    );

    if (!fixBody || Object.keys(fixBody).length === 0) break;

    retryCount += 1;
    const next = await executeAttempt(
      item,
      opts,
      fixBody,
      `autoFix: added payload fields ${Object.keys(fixBody).join(", ")}`,
      retryCount + 1
    );
    attempts.push(next);
    latest = next;
    captureIdsFromResponse(next, opts.runtime);
  }

  return finalizeResult(item, attempts);
}

function finalizeResult(item, attempts) {
  const last = attempts[attempts.length - 1];
  return {
    ...item,
    skipped: Boolean(last && last.skipped),
    skipReason: last && last.skipped ? last.skipReason : null,
    ok: Boolean(last && last.ok),
    status: last && typeof last.status === "number" ? last.status : 0,
    durationMs: last && typeof last.durationMs === "number" ? last.durationMs : 0,
    urlResolved: last && last.request ? last.request.url : item.url,
    responseSample:
      last && typeof last.responseBody === "string" ? last.responseBody.slice(0, 500) : "",
    responseBytes: last && typeof last.responseBytes === "number" ? last.responseBytes : 0,
    error: last ? last.error || null : null,
    retryCount: Math.max(0, attempts.length - 1),
    autoFixApplied: attempts.some((a) => Boolean(a.fixNote)),
    autoFixNotes: attempts.filter((a) => a.fixNote).map((a) => a.fixNote),
    attempts
  };
}

async function runPool(items, worker, concurrency, intervalMs, onDone) {
  const out = [];
  let index = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const result = await worker(items[currentIndex], currentIndex);
      out[currentIndex] = result;
      if (typeof onDone === "function") onDone(result, currentIndex, items.length);
      if (intervalMs > 0) await sleep(intervalMs);
    }
  });
  await Promise.all(workers);
  return out;
}

function summarize(results, inputMeta) {
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: inputMeta.mode,
    baseUrl: inputMeta.baseUrl,
    totalRequests: results.length,
    totals: {
      discovered: results.length,
      executed: 0,
      skipped: 0,
      passed: 0,
      failed: 0,
      retried: 0,
      autoFixApplied: 0
    },
    byMethod: {},
    byStatus: {},
    latencyMs: {
      average: 0,
      p50: 0,
      p95: 0,
      max: 0
    },
    slowest: [],
    failures: [],
    skipped: []
  };

  const durations = [];

  for (const r of results) {
    const method = r.method || "UNKNOWN";
    if (!summary.byMethod[method]) {
      summary.byMethod[method] = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      };
    }
    summary.byMethod[method].total += 1;
    summary.totals.retried += r.retryCount || 0;
    if (r.autoFixApplied) summary.totals.autoFixApplied += 1;

    if (r.skipped) {
      summary.totals.skipped += 1;
      summary.byMethod[method].skipped += 1;
      summary.skipped.push({
        method,
        requestName: r.requestName,
        sourceFile: r.sourceFile,
        reason: r.skipReason || "unknown"
      });
      continue;
    }

    summary.totals.executed += 1;
    durations.push(r.durationMs || 0);
    const statusKey = String(r.status || 0);
    summary.byStatus[statusKey] = (summary.byStatus[statusKey] || 0) + 1;

    if (r.ok) {
      summary.totals.passed += 1;
      summary.byMethod[method].passed += 1;
    } else {
      summary.totals.failed += 1;
      summary.byMethod[method].failed += 1;
      summary.failures.push({
        method,
        requestName: r.requestName,
        sourceFile: r.sourceFile,
        status: r.status || 0,
        url: r.urlResolved || r.url,
        error: r.error || null,
        autoFixNotes: r.autoFixNotes || []
      });
    }
  }

  if (durations.length) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    summary.latencyMs.average = Number(avg.toFixed(2));
    summary.latencyMs.p50 = Number(percentile(durations, 50).toFixed(2));
    summary.latencyMs.p95 = Number(percentile(durations, 95).toFixed(2));
    summary.latencyMs.max = Number(Math.max(...durations).toFixed(2));
  }

  summary.slowest = results
    .filter((r) => !r.skipped)
    .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
    .slice(0, 10)
    .map((r) => ({
      method: r.method,
      requestName: r.requestName,
      sourceFile: r.sourceFile,
      status: r.status,
      durationMs: r.durationMs,
      url: r.urlResolved || r.url
    }));

  return summary;
}

function buildMarkdown(summary) {
  const lines = [];
  lines.push(`# API Analytics Report`);
  lines.push(``);
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push(`Mode: ${summary.mode}`);
  lines.push(`Base URL: ${summary.baseUrl}`);
  lines.push(``);
  lines.push(`## Totals`);
  lines.push(`- Discovered: ${summary.totals.discovered}`);
  lines.push(`- Executed: ${summary.totals.executed}`);
  lines.push(`- Passed: ${summary.totals.passed}`);
  lines.push(`- Failed: ${summary.totals.failed}`);
  lines.push(`- Skipped: ${summary.totals.skipped}`);
  lines.push(`- Retries Used: ${summary.totals.retried}`);
  lines.push(`- Auto Fix Applied: ${summary.totals.autoFixApplied}`);
  lines.push(``);
  lines.push(`## Latency (ms)`);
  lines.push(`- Average: ${summary.latencyMs.average}`);
  lines.push(`- P50: ${summary.latencyMs.p50}`);
  lines.push(`- P95: ${summary.latencyMs.p95}`);
  lines.push(`- Max: ${summary.latencyMs.max}`);
  lines.push(``);
  lines.push(`## By Status`);
  Object.keys(summary.byStatus)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((status) => lines.push(`- ${status}: ${summary.byStatus[status]}`));
  lines.push(``);
  lines.push(`## Failures`);
  if (!summary.failures.length) {
    lines.push(`- none`);
  } else {
    summary.failures.slice(0, 80).forEach((f) => {
      lines.push(
        `- ${f.status} | ${f.method} | ${f.requestName} | ${f.error || "http error"}`
      );
    });
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  if (!["safe", "full"].includes(args.mode)) {
    console.error(`Invalid --mode "${args.mode}". Use safe or full.`);
    process.exit(1);
  }
  if (!["js", "json"].includes(args.source)) {
    console.error(`Invalid --source "${args.source}". Use js or json.`);
    process.exit(1);
  }

  const vars = { ...args.vars, P: args.baseUrl };
  let requests = [];

  if (args.source === "js") {
    const base = stripTrailingSlash(args.baseUrl);
    requests = discoverJsRequests(args.rootDir).map((r) => ({
      ...r,
      url: `${base}${r.urlPath}`
    }));
  } else {
    const files = walkJsonFiles(args.rootDir);
    for (const file of files) {
      const doc = readJson(file);
      if (!doc || !doc.meta || doc.meta.format !== "httpie") continue;
      requests.push(...extractHttpieRequests(doc, file));
    }
  }

  if (!requests.length) {
    console.error(`No requests found under: ${args.rootDir}`);
    process.exit(1);
  }

  const queue = args.maxRequests ? requests.slice(0, args.maxRequests) : requests;
  console.log(
    `Discovered ${requests.length} requests (${queue.length} selected), mode=${args.mode}, baseUrl=${args.baseUrl}`
  );

  const reportDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = nowTs();
  const runDir = path.join(reportDir, `api-analytics-run-${stamp}`);
  fs.mkdirSync(runDir, { recursive: true });
  const callsLogPath = path.join(runDir, "calls.ndjson");

  const runtime = { idPool: {} };
  const results = await runPool(
    queue,
    (item) =>
      executeWithAutoFix(item, {
        mode: args.mode,
        timeoutMs: args.timeoutMs,
        baseUrl: args.baseUrl,
        vars,
        runtime,
        autoFix: args.autoFix,
        retries: args.retries
      }),
    args.concurrency,
    args.intervalMs,
    (result, index, total) => {
      const statusLabel = result.skipped
        ? `SKIP ${result.skipReason || ""}`.trim()
        : `${result.status} ${result.ok ? "OK" : "FAIL"}`;
      console.log(`[${index + 1}/${total}] ${statusLabel} ${result.method} ${result.urlResolved || result.url}`);
      fs.appendFileSync(callsLogPath, `${JSON.stringify(result)}\n`, "utf8");
    }
  );

  const summary = summarize(results, {
    mode: args.mode,
    baseUrl: args.baseUrl
  });

  const jsonPath = path.join(reportDir, `api-analytics-${stamp}.json`);
  const mdPath = path.join(reportDir, `api-analytics-${stamp}.md`);

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        summary,
        runDir,
        callsLogPath,
        results
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(mdPath, buildMarkdown(summary), "utf8");

  console.log(`\nReport written:`);
  console.log(`- ${jsonPath}`);
  console.log(`- ${mdPath}`);
  console.log(`- ${callsLogPath}`);
  console.log(
    `\nExecuted ${summary.totals.executed}, passed ${summary.totals.passed}, failed ${summary.totals.failed}, skipped ${summary.totals.skipped}, retries ${summary.totals.retried}`
  );
}

main().catch((err) => {
  console.error("Runner crashed:", err);
  process.exit(1);
});
