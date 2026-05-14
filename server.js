const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const GRAPH_CONFIG_FILE = path.join(DATA_DIR, "graph_config.json");

// Check for Node.js 18+ (Required for global fetch)
const nodeVersion = parseInt(process.versions.node.split(".")[0]);
if (nodeVersion < 18) {
  console.error(`ERROR: Node.js version 18 or higher is required. You are running ${process.version}.`);
  process.exit(1);
}

const researchCache = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function ensureDataStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "[]\n", "utf8");
  }

  if (!fs.existsSync(GRAPH_CONFIG_FILE)) {
    fs.writeFileSync(GRAPH_CONFIG_FILE, "{}\n", "utf8");
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function readHistory() {
  ensureDataStore();

  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  ensureDataStore();
  fs.writeFileSync(HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

function readGraphConfig(includeToken = false) {
  ensureDataStore();
  try {
    const raw = fs.readFileSync(GRAPH_CONFIG_FILE, "utf8");
    const config = JSON.parse(raw);
    const clean = {
      apiVersion: config.apiVersion || "v25.0",
      igUserId: String(config.igUserId || "").trim(),
      accessToken: String(config.accessToken || "").trim(),
      keywords: String(config.keywords || "").trim(),
    };
    if (includeToken) return clean;
    return {
      apiVersion: clean.apiVersion,
      igUserId: clean.igUserId,
      keywords: clean.keywords,
      configured: !!(clean.igUserId && clean.accessToken),
      tokenPreview: clean.accessToken ? `${clean.accessToken.slice(0, 6)}...` : ""
    };
  } catch {
    return { apiVersion: "v25.0", igUserId: "", configured: false, tokenPreview: "" };
  }
}

function writeGraphConfig(config) {
  ensureDataStore();
  const previous = readGraphConfig(true);
  
  const cleaned = {
    apiVersion: (config.apiVersion || previous.apiVersion || "v25.0").trim().replace(/^\//, ""),
    igUserId: (config.igUserId || previous.igUserId || "").trim(),
    accessToken: (config.accessToken || previous.accessToken || "").trim(),
    keywords: config.keywords !== undefined ? String(config.keywords || "").trim() : previous.keywords,
  };
  if (!/^v\d+\.\d+$/.test(cleaned.apiVersion)) {
    cleaned.apiVersion = "v25.0";
  }
  fs.writeFileSync(GRAPH_CONFIG_FILE, JSON.stringify(cleaned, null, 2) + "\n", "utf8");
  return readGraphConfig(false);
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "InstaListLinkChecker/1.0"
      },
      ...options
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkLink(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) {
    return {
      url: rawUrl,
      ok: false,
      status: null,
      finalUrl: null,
      message: "Invalid URL format"
    };
  }

  try {
    let response = await fetchWithTimeout(url, { method: "HEAD" });

    if (response.status === 405 || response.status === 403) {
      response = await fetchWithTimeout(url, { method: "GET" });
    }

    return {
      url,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      message: response.ok ? "Working" : `Returned HTTP ${response.status}`
    };
  } catch (error) {
    const isTimeout = error && error.name === "AbortError";
    return {
      url,
      ok: false,
      status: null,
      finalUrl: null,
      message: isTimeout ? "Timed out" : "Could not be reached"
    };
  }
}

function parseNumber(value, isPostCount = false) {
  if (typeof value === "number") return value;
  if (!value) return null;
  // Fuzzy extraction: handle "null" and find numbers
  const normalized = String(value).toLowerCase().replace(/,/g, "").trim();
  if (["null", "unknown", "none"].includes(normalized)) return null;
  const match = normalized.match(/([\d.]+)\s*(k|m|b|thousand|million|billion)?/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  const suffix = match[2];
  if (isPostCount && (suffix === "b" || suffix === "billion")) return null;
  if (match[2] === "k" || match[2] === "thousand") return Math.round(number * 1_000);
  if (match[2] === "m" || match[2] === "million") return Math.round(number * 1_000_000);
  if (match[2] === "b" || match[2] === "billion") return Math.round(number * 1_000_000_000);
  return Math.round(number);
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const rawPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
  const safePath = path.normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/history") {
      sendJson(res, 200, readHistory());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/graph-config") {
      sendJson(res, 200, readGraphConfig(false));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/history") {
      const body = await readBody(req);
      let entry;
      try {
        entry = JSON.parse(body || "{}");
      } catch (e) {
        return sendJson(res, 400, { error: "Invalid JSON in request body" });
      }
      const history = readHistory();
      const nextEntry = {
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        ...entry
      };

      history.unshift(nextEntry);
      writeHistory(history.slice(0, 100));
      sendJson(res, 201, nextEntry);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/graph-config") {
      const body = await readBody(req);
      const config = JSON.parse(body || "{}");
      sendJson(res, 200, writeGraphConfig(config));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/research") {
      const body = await readBody(req);
      let raw = [];
      try {
        const parsed = JSON.parse(body || "{}");
        raw = Array.isArray(parsed.influencers) ? parsed.influencers : [];
      } catch (e) {
        return sendJson(res, 400, { error: "Invalid JSON in request body" });
      }
      
      const normalized = [...new Set(raw.map(extractHandle).filter(Boolean))];

      const results = [];
      const config = readGraphConfig(true);

      for (const handle of normalized) {
        const res = await researchInfluencer(handle);
        results.push(res);
        await new Promise((resolve) => setTimeout(resolve, 3000)); // Increased delay
      }

      sendJson(res, 200, { results });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/check-links") {
      const body = await readBody(req);
      const { links } = JSON.parse(body || "{}");
      const uniqueLinks = [...new Set(Array.isArray(links) ? links : [])];
      const results = [];

      for (const link of uniqueLinks) {
        results.push(await checkLink(link));
      }

      sendJson(res, 200, { results });
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error" });
  }
});

function extractHandle(value) {
  const text = String(value || "").trim();
  const clean = text.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "");
  const handle = clean.split(/[/\?#\s,;]/)[0].toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

async function graphResearchAccount(handle, config, tokenIndex = 0) {
  const tokens = config.accessToken.split(",").map(t => t.trim()).filter(Boolean);
  if (!tokens.length) return { handle, ok: false, message: "No Graph API tokens configured." };
  
  const token = tokens[tokenIndex % tokens.length];

  try {
    const query = new URLSearchParams({
      fields: `business_discovery.username(${handle}){username,name,followers_count,media_count,media.limit(10){permalink,caption,timestamp,media_type,media_url,like_count,comments_count}}`,
      access_token: token
    });
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.igUserId}?${query}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      // If rate limited and we have more tokens, rotate
      if ((data.error.code === 4 || data.error.code === 17) && tokenIndex < tokens.length - 1) {
        console.log(`DEBUG: Token ${tokenIndex} rate limited. Trying next...`);
        return graphResearchAccount(handle, config, tokenIndex + 1);
      }
      throw new Error(data.error.message);
    }

    const biz = data.business_discovery || {};
    return {
      handle: biz.username || handle,
      ok: true,
      name: biz.name || null,
      followers: biz.followers_count || 0,
      postCount: biz.media_count || 0,
      posts: (biz.media?.data || []).map(p => ({
        url: p.permalink,
        date: p.timestamp,
        info: p.caption,
        links: []
      })),
      source: "graph",
      message: "Researched via Graph API."
    };
  } catch (e) {
    return { handle, ok: false, message: "Graph API Error: " + e.message };
  }
}

async function researchInfluencer(input) {
  const handle = extractHandle(input);
  if (!handle) return { handle: input, ok: false, message: "Invalid handle." };

  const cached = researchCache.get(handle);
  if (cached && (Date.now() - new Date(cached.researchedAt).getTime() < 86400000)) {
    return cached;
  }

  const config = readGraphConfig(true);

  if (config.igUserId && config.accessToken) {
    try {
      const result = await graphResearchAccount(handle, config);
      if (result.ok) {
        result.researchedAt = new Date().toISOString();
        researchCache.set(handle, result);
      }
      return result;
    } catch (err) {
      return { handle, ok: false, message: err.message };
    }
  }
  return { handle, ok: false, message: "Graph API not configured." };
}

ensureDataStore();

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`ERROR: Port ${PORT} is already being used by another application. Close it and try again.`);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Insta List is running at http://${displayHost}:${PORT}`);
});
