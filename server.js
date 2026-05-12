const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 5173;
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
      aiEnabled: !!config.aiEnabled,
      aiProvider: String(config.aiProvider || "gemini").trim(),
      aiApiKey: String(config.aiApiKey || "").trim(),
      aiModel: String(config.aiModel || "gemini-2.0-flash").trim()
    };
    if (includeToken) return clean;
    return {
      apiVersion: clean.apiVersion,
      igUserId: clean.igUserId,
      keywords: clean.keywords,
      aiEnabled: clean.aiEnabled,
      aiProvider: clean.aiProvider,
      aiModel: clean.aiModel,
      aiConfigured: !!clean.aiApiKey,
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
    apiVersion: config.apiVersion !== undefined ? String(config.apiVersion || "v25.0").trim().replace(/^\//, "") : previous.apiVersion,
    igUserId: config.igUserId !== undefined ? String(config.igUserId || "").trim() : previous.igUserId,
    accessToken: String(config.accessToken || "").trim() || previous.accessToken,
    keywords: config.keywords !== undefined ? String(config.keywords || "").trim() : previous.keywords,
    aiEnabled: config.aiEnabled !== undefined ? !!config.aiEnabled : previous.aiEnabled,
    aiProvider: config.aiProvider !== undefined ? String(config.aiProvider || "gemini").trim() : previous.aiProvider,
    aiApiKey: String(config.aiApiKey || "").trim() || previous.aiApiKey,
    aiModel: config.aiModel !== undefined ? String(config.aiModel || "gemini-2.0-flash").trim() : previous.aiModel
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

async function fetchWebContext(handle) {
  try {
    const query = `instagram ${handle} followers count`;
    const url = `https://duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    });
    const content = await resp.text();
    
    // permissve extraction
    const results = [...content.matchAll(/class="result-(?:link|snippet)"[^>]*>(.*?)</gs)];
    const context = results.slice(0, 15).map(m => {
      return m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    }).join(" | ");

    if (context) return context;
    // Plan B: generic body text
    return content.replace(/<[^>]+>/g, " ").slice(0, 1000);
  } catch (e) {
    return "";
  }
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
      const delay = config.aiProvider === "ollama" ? 200 : 1000;

      for (const handle of normalized) {
        const res = await researchInfluencer(handle);
        results.push(res);
        await new Promise((resolve) => setTimeout(resolve, delay));
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

async function aiResearchAccount(handle, config) {
  const provider = config.aiProvider || "gemini";
  let url, body;
  const webContext = await fetchWebContext(handle);

  console.log(`DEBUG: AI Research for @${handle}`);
  console.log(`DEBUG: Web Context: ${webContext.slice(0, 500)}...`);

  const prompt = `CONTEXT: Instagram metrics for @${handle}.
  SEARCH_DATA: ${webContext || 'None'}
  
  INSTRUCTIONS: Extract followers and postCount. Distinguish between large follower counts and small post counts.
  
  RULES:
  1. Extract 'followers' (e.g., 660M, 500K).
  2. Extract 'postCount'. IG accounts rarely exceed 60k posts. If you see a number in Billions/Millions for posts, it is WRONG; use 'unknown' instead.
  3. If SEARCH_DATA is empty, use internal memory and add '[Static]' to the name.
  4. Return valid JSON only.
  
  FORMAT: {"followers": "string", "postCount": "string", "name": "string", "posts": []}`;

  if (provider === "ollama") {
    url = "http://localhost:11434/api/chat";
    body = JSON.stringify({
      model: config.aiModel, // Use the configured Ollama model directly
      messages: [
        { role: "system", content: "You are a data assistant. Return valid JSON. Always provide numbers for followers/posts based on text or your memory. Never return null; use 'unknown' if you have no idea." },
        { role: "user", content: prompt }
      ],
      stream: false,
      format: "json",
      options: {
        temperature: 0.1, // Drastically reduce randomness to prevent hallucination
        seed: 42
      }
    });
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${config.aiModel}:generateContent?key=${config.aiApiKey}`;
    body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {} // JSON mode is incompatible with Google Search grounding
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await resp.json();

    let text = provider === "ollama" ? (data.message?.content || "") : (data.candidates?.[0]?.content?.parts?.[0]?.text || "");
    
    console.log(`DEBUG: Raw AI Response for @${handle}: ${text.slice(0, 500)}...`);

    // Robust JSON extraction
    const jsonMatch = text.match(/(\{.*\})/s);
    let aiData;
    if (jsonMatch) {
      try {
        aiData = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error(`ERROR: Failed to parse JSON from AI response for @${handle}: ${e.message}. Raw JSON part: ${jsonMatch[1].slice(0, 200)}...`);
        aiData = {};
      }
    } else {
      console.log(`DEBUG: No valid JSON found in AI response for @${handle}. Defaulting to empty JSON.`);
      aiData = {};
    }
    console.log(`DEBUG: Parsed AI Data for @${handle}:`, aiData);

    return {
      handle,
      url: `https://instagram.com/${handle}/`,
      ok: !!parseNumber(aiData.followers), 
      followers: parseNumber(aiData.followers),
      postCount: parseNumber(aiData.postCount, true),
      name: aiData.name || null,
      posts: (aiData.posts || []).map(p => ({
        url: p.url,
        date: p.date,
        info: p.caption,
        links: []
      })),
      source: "ai",
      message: "Researched using AI Agent.",
      researchedAt: new Date().toISOString()
    };
  } catch (e) {
    console.error("AI Research Exception:", e);
    if (e.name === 'AbortError') {
      return { handle, ok: false, message: "AI Research timed out (120s). The model may still be loading into GPU memory." };
    }
    if (provider === 'ollama') {
      if (e.message.includes('fetch failed') || (e.cause && e.cause.code === 'ECONNREFUSED')) {
        return { handle, ok: false, message: "Ollama connection refused. Is the app running?" };
      }
    }
    return { handle, ok: false, message: "AI Research failed: " + e.message };
  }
}

async function graphResearchAccount(handle, config) {
  try {
    const query = new URLSearchParams({
      fields: `business_discovery.username(${handle}){username,name,followers_count,media_count,media.limit(10){permalink,caption,timestamp,media_type,media_url,like_count,comments_count}}`,
      access_token: config.accessToken
    });
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.igUserId}?${query}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) throw new Error(data.error.message);

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
  if (!handle) return { input, ok: false, message: "Invalid handle." };

  const cached = researchCache.get(handle);
  if (cached && (Date.now() - new Date(cached.researchedAt).getTime() < 86400000)) {
    console.log(`DEBUG: Returning cached data for @${handle}`);
    return cached;
  }

  const config = readGraphConfig(true);
  let result = { handle, ok: false, message: "No engine available." };

  if (config.igUserId && config.accessToken) {
    result = await graphResearchAccount(handle, config);
  }

  if (!result.ok && config.aiEnabled) {
    const aiResult = await aiResearchAccount(handle, config);
    if (aiResult.ok) {
      researchCache.set(handle, aiResult);
      return aiResult;
    }
    
    // If AI fails too, return the AI result object with the combined error
    aiResult.message = `Graph API: ${result.message} | AI Agent: ${aiResult.message}`;
    return aiResult;
  }

  if (result.ok) researchCache.set(handle, result);
  return result;
}

ensureDataStore();

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`ERROR: Port ${PORT} is already being used by another application. Close it and try again.`);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`Insta List is running at http://localhost:${PORT}`);
});
