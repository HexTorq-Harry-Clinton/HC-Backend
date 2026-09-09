const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const ROOT_DIR = path.join(process.cwd(), "routes", "HARRY_CLINTON");
const API_PREFIX = "/API/HARRY-CLINTON";

function normalizeRoutePath(p) {
  if (!p) return "/";
  let out = String(p).trim();
  if (!out.startsWith("/")) out = `/${out}`;
  return out.replace(/\/{2,}/g, "/");
}

function normalizeJoinedPath(a, b) {
  const left = normalizeRoutePath(a).replace(/\/$/, "");
  const right = normalizeRoutePath(b);
  return `${left}${right}`.replace(/\/{2,}/g, "/");
}

function parseMountsFromIndex(indexPath) {
  const out = [];
  if (!fs.existsSync(indexPath)) return out;
  const text = fs.readFileSync(indexPath, "utf8");
  const rx =
    /router\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*require\(\s*['"`](\.\/[^'"`]+)['"`]\s*\)\s*\)/g;
  let m = rx.exec(text);
  while (m) {
    out.push({ mountPath: normalizeRoutePath(m[1]), requirePath: m[2] });
    m = rx.exec(text);
  }
  return out;
}

function resolveRouteFile(rootDir, requirePath) {
  const noDot = requirePath.replace(/^\.\//, "");
  const asJs = path.join(rootDir, `${noDot}.js`);
  if (fs.existsSync(asJs)) return asJs;
  const asIndex = path.join(rootDir, noDot, "index.js");
  if (fs.existsSync(asIndex)) return asIndex;
  return null;
}

function unique(arr) {
  return [...new Set(arr)];
}

function parseConstFieldArray(fileText, constName) {
  const rx = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`, "i");
  const m = rx.exec(fileText);
  if (!m || !m[1]) return [];
  const fields = [];
  const tokenRx = /['"`]([A-Za-z0-9_]+)['"`]/g;
  let t = tokenRx.exec(m[1]);
  while (t) {
    fields.push(t[1]);
    t = tokenRx.exec(m[1]);
  }
  return unique(fields);
}

function tokenize(text) {
  return (String(text || "").match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).filter(Boolean);
}

function extractFieldsForMethod(text, method, urlPath) {
  const lowerMethod = method.toLowerCase();
  const startRx = new RegExp(`router\\.${lowerMethod}\\s*\\(`, "i");
  const sm = startRx.exec(text);
  const block = sm ? text.slice(sm.index, sm.index + 3500) : text;

  const fields = [];
  const patterns = [
    /!data\.([A-Za-z0-9_]+)/g,
    /req\.body\.([A-Za-z0-9_]+)/g,
    /["'`]([A-Za-z0-9_]+)["'`]\s+required/gi
  ];
  for (const rx of patterns) {
    let m = rx.exec(block);
    while (m) {
      fields.push(m[1]);
      m = rx.exec(block);
    }
  }

  const dRx = /{([^}]+)}\s*=\s*req\.body/gi;
  let dm = dRx.exec(block);
  while (dm) {
    const names = dm[1]
      .split(",")
      .map((s) => s.trim().replace(/=.*$/, ""))
      .filter(Boolean);
    fields.push(...names);
    dm = dRx.exec(block);
  }

  if (lowerMethod === "post") fields.push(...parseConstFieldArray(text, "INSERT_FIELDS"));
  if (lowerMethod === "put" || lowerMethod === "patch") {
    fields.push(...parseConstFieldArray(text, "UPDATE_FIELDS"));
  }
  if (lowerMethod === "delete") {
    fields.push(...parseConstFieldArray(text, "UPDATE_FIELDS"));
  }

  const pathParams = String(urlPath).match(/:([A-Za-z0-9_]+)/g) || [];
  for (const p of pathParams) fields.push(p.slice(1));

  return unique(fields);
}

function defaultValue(field) {
  const f = String(field || "").toLowerCase();
  if (f === "rcu" || f === "luu") return "UI_TESTER";
  if (f.includes("email")) return "tester@example.com";
  if (f.includes("password")) return "Pass@123456";
  if (f.includes("mobile") || f.includes("phone")) return "9999999999";
  if (f.includes("otp")) return "123456";
  if (f.includes("date") || f.includes("time")) return new Date().toISOString();
  if (f.includes("rating")) return 4;
  if (f.includes("qty") || f.includes("count") || f.includes("total")) return 1;
  if (f.endsWith("_id") || f === "id") return `${f}_001`;
  if (f.startsWith("is_") || f.startsWith("has_")) return false;
  return `${f}_sample`;
}

function makeSampleBody(method, fields) {
  const write = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  if (!write) return null;
  const body = {};
  for (const f of fields) body[f] = defaultValue(f);
  return Object.keys(body).length ? body : null;
}

function discoverRoutes() {
  const routesIndex = path.join(ROOT_DIR, "index.js");
  const mounts = parseMountsFromIndex(routesIndex);
  const all = [];

  for (const m of mounts) {
    const routeFile = resolveRouteFile(ROOT_DIR, m.requirePath);
    if (!routeFile) continue;
    const text = fs.readFileSync(routeFile, "utf8");
    const rx = /router\.(get|post|put|delete|patch|head|options)\s*\(\s*(['"`])([^'"`]+)\2/gi;
    let match = rx.exec(text);
    while (match) {
      const method = String(match[1]).toUpperCase();
      const local = normalizeRoutePath(match[3]);
      const fullPath = normalizeJoinedPath(m.mountPath, local);
      const fields = extractFieldsForMethod(text, method, fullPath);
      all.push({
        method,
        path: `${API_PREFIX}${fullPath}`,
        routePath: fullPath,
        sourceFile: routeFile,
        fields,
        sampleBody: makeSampleBody(method, fields)
      });
      match = rx.exec(text);
    }
  }

  return all;
}

router.get("/routes", (req, res) => {
  const routes = discoverRoutes();
  res.json({
    success: true,
    count: routes.length,
    routes
  });
});

router.post("/execute", async (req, res) => {
  try {
    const method = String(req.body.method || "GET").toUpperCase();
    const url = String(req.body.url || "");
    const headers = req.body.headers && typeof req.body.headers === "object" ? req.body.headers : {};
    const body = req.body.body;
    const timeoutMs = Number(req.body.timeoutMs || 20000);

    if (!url) {
      return res.status(400).json({ success: false, message: "url is required" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    const response = await fetch(url, {
      method,
      headers,
      body:
        method === "GET" || method === "HEAD"
          ? undefined
          : body == null
            ? undefined
            : typeof body === "string"
              ? body
              : JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_err) {
      json = null;
    }

    return res.json({
      success: true,
      status: response.status,
      ok: response.ok,
      durationMs: Date.now() - startedAt,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      responseText: text,
      responseJson: json
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err && err.message ? err.message : "request failed"
    });
  }
});

module.exports = router;
