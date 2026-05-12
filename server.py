from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json
import mimetypes
import re
import socket
import ssl
import time
import uuid
from datetime import datetime, timezone


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
DATA_DIR = ROOT / "data"
HISTORY_FILE = DATA_DIR / "history.json"
GRAPH_CONFIG_FILE = DATA_DIR / "graph_config.json"
PORT = 5173

KNOWN_ACCOUNT_ALIASES = {
    "cristiano ronaldo": {"handle": "cristiano", "name": "Cristiano Ronaldo"},
    "cristiano": {"handle": "cristiano", "name": "Cristiano Ronaldo"},
    "ronaldo": {"handle": "cristiano", "name": "Cristiano Ronaldo"},
    "cr7": {"handle": "cristiano", "name": "Cristiano Ronaldo"},
    "lionel messi": {"handle": "leomessi", "name": "Lionel Messi"},
    "leo messi": {"handle": "leomessi", "name": "Lionel Messi"},
    "messi": {"handle": "leomessi", "name": "Lionel Messi"},
    "selena gomez": {"handle": "selenagomez", "name": "Selena Gomez"},
    "ariana grande": {"handle": "arianagrande", "name": "Ariana Grande"},
    "kylie jenner": {"handle": "kyliejenner", "name": "Kylie Jenner"},
    "dwayne johnson": {"handle": "therock", "name": "Dwayne Johnson"},
    "the rock": {"handle": "therock", "name": "Dwayne Johnson"},
    "kim kardashian": {"handle": "kimkardashian", "name": "Kim Kardashian"},
    "beyonce": {"handle": "beyonce", "name": "Beyonce"},
    "nike": {"handle": "nike", "name": "Nike"},
}


def ensure_data_store():
    DATA_DIR.mkdir(exist_ok=True)
    if not HISTORY_FILE.exists():
        HISTORY_FILE.write_text("[]\n", encoding="utf-8")
    if not GRAPH_CONFIG_FILE.exists():
        GRAPH_CONFIG_FILE.write_text("{}\n", encoding="utf-8")


def read_history():
    ensure_data_store()
    try:
        data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def write_history(history):
    ensure_data_store()
    HISTORY_FILE.write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")


def read_graph_config(include_token=False):
    ensure_data_store()
    try:
        config = json.loads(GRAPH_CONFIG_FILE.read_text(encoding="utf-8"))
        if not isinstance(config, dict):
            config = {}
    except (OSError, json.JSONDecodeError):
        config = {}

    clean = {
        "apiVersion": config.get("apiVersion") or "v25.0",
        "igUserId": str(config.get("igUserId") or "").strip(),
        "accessToken": str(config.get("accessToken") or "").strip(),
        "keywords": str(config.get("keywords") or "").strip(),
        "aiEnabled": bool(config.get("aiEnabled", False)),
        "aiProvider": str(config.get("aiProvider") or "gemini").strip(),
        "aiApiKey": str(config.get("aiApiKey") or "").strip(),
        "aiModel": str(config.get("aiModel") or "gemini-2.0-flash").strip(),
    }
    if include_token:
        return clean

    return {
        "apiVersion": clean["apiVersion"],
        "igUserId": clean["igUserId"],
        "configured": bool(clean["igUserId"] and clean["accessToken"]),
        "keywords": clean["keywords"],
        "aiEnabled": clean["aiEnabled"],
        "aiProvider": clean["aiProvider"],
        "aiModel": clean["aiModel"],
        "aiConfigured": bool(clean["aiApiKey"]),
        "tokenPreview": f"{clean['accessToken'][:6]}..." if clean["accessToken"] else "",
    }


def write_graph_config(config):
    ensure_data_store()
    previous = read_graph_config(include_token=True)
    cleaned = {
        "apiVersion": str(config.get("apiVersion") or previous.get("apiVersion", "v25.0")).strip().lstrip("/"),
        "igUserId": str(config.get("igUserId", previous.get("igUserId", ""))).strip(),
        "accessToken": str(config.get("accessToken") or "").strip() or previous.get("accessToken", ""),
        "keywords": str(config.get("keywords", previous.get("keywords", ""))).strip(),
        "aiEnabled": config.get("aiEnabled", previous.get("aiEnabled", False)),
        "aiProvider": str(config.get("aiProvider", previous.get("aiProvider", "gemini"))).strip(),
        "aiApiKey": str(config.get("aiApiKey", "")).strip() or previous.get("aiApiKey", ""),
        "aiModel": str(config.get("aiModel", previous.get("aiModel", "gemini-2.0-flash"))).strip(),
    }
    if not re.match(r"^v\d+\.\d+$", cleaned["apiVersion"]):
        cleaned["apiVersion"] = "v25.0"
    GRAPH_CONFIG_FILE.write_text(json.dumps(cleaned, indent=2) + "\n", encoding="utf-8")
    return read_graph_config(include_token=False)


def normalize_url(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return raw


def parse_count(value, is_post_count=False):
    if isinstance(value, (int, float)):
        return int(value)
    if not value:
        return None
    # Fuzzy extraction: handle strings like "null", "unknown", and find first number
    text = str(value).replace(",", "").strip().lower()
    if text in ("null", "unknown", "none"): return None
    match = re.search(r"([\d.]+)\s*(k|m|b|thousand|million|billion)?", text)
    if not match:
        return None
    number = float(match.group(1))
    suffix = match.group(2)
    if is_post_count and suffix in ("b", "billion"):
        return None # Sanity check: No one has billions of posts
    if suffix == "k" or suffix == "thousand":
        number *= 1_000
    elif suffix == "m" or suffix == "million":
        number *= 1_000_000
    elif suffix == "b" or suffix == "billion":
        number *= 1_000_000_000
    return round(number)


def normalize_lookup(value):
    text = str(value or "").lower().strip()
    text = re.sub(r"^https?://(www\.)?instagram\.com/", "", text)
    text = text.replace("@", "")
    text = re.sub(r"([\d,.]+)\s*([kmb])?\s*(followers?|follower count|posts?|post count|media)", "", text)
    text = re.sub(r"[/?#;,]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_handle(value):
    text = str(value or "").strip()
    text = re.sub(r"^https?://(www\.)?instagram\.com/", "", text, flags=re.I)
    text = text.lstrip("@")
    text = re.split(r"[/\?#\s,;]", text)[0].lower()
    return text if re.match(r"^[a-z0-9._]{1,30}$", text) else None


def resolve_account(value):
    lookup = normalize_lookup(value)
    known = KNOWN_ACCOUNT_ALIASES.get(lookup)
    if known:
        return {**known, "sourceName": str(value), "resolved": lookup != known["handle"]}
    handle = extract_handle(value)
    if handle:
        return {"handle": handle, "name": None, "sourceName": str(value), "resolved": False}
    return None


def graph_request(path, params, config):
    query = urlencode({**params, "access_token": config["accessToken"]})
    url = f"https://graph.facebook.com/{config['apiVersion']}/{path}?{query}"
    print(f"DEBUG: Calling Graph API: https://graph.facebook.com/{config['apiVersion']}/{path}?fields=...")
    request = Request(url, headers={"User-Agent": "InstaListGraphClient/1.0"})
    with urlopen(request, timeout=20, context=ssl.create_default_context()) as response:
        return json.loads(response.read().decode("utf-8"))


def normalize_graph_post(post):
    children = post.get("children", {}).get("data", []) if isinstance(post.get("children"), dict) else []
    info = post.get("caption") or ""
    return {
        "id": post.get("id"),
        "url": post.get("permalink") or "",
        "link": post.get("permalink") or "",
        "date": post.get("timestamp") or "",
        "caption": info,
        "info": info or f"{post.get('media_type', 'Media')} post",
        "mediaType": post.get("media_type"),
        "mediaUrl": post.get("media_url"),
        "likeCount": post.get("like_count"),
        "commentsCount": post.get("comments_count"),
        "children": children,
    }


def fetch_web_context(handle):
    """Fetches real-time snippets from DuckDuckGo to provide 'eyes' to the AI."""
    try:
        # Broad query for better snippets
        query = f"instagram {handle} followers posts"
        url = f"https://duckduckgo.com/lite/?q={urlencode({'q': query})}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        req = Request(url, headers=headers)
        with urlopen(req, timeout=10) as resp:
            content = resp.read().decode("utf-8")
            # Extremely robust extraction: look for anything between result-link/snippet classes OR generic link text
            raw_results = re.findall(r'class="result-(?:link|snippet)"[^>]*>(.*?)<', content, re.S)
            context_parts = []
            for snippet in raw_results[:15]:
                clean_text = snippet.strip()
                clean_text = re.sub(r'<[^>]+>', '', clean_text).replace("&nbsp;", " ").strip()
                if clean_text:
                    context_parts.append(clean_text)

            # Plan B: If regex fails, just grab the first 1000 characters of the body text
            if not context_parts:
                body_text = re.sub(r'<[^>]+>', ' ', content)
                return body_text[:1000]

            return " ".join(context_parts)
    except Exception as e:
        print(f"DEBUG: Web search failed: {e}")
        return ""

def ai_research_account(handle, config, retry_count=0):
    provider = config.get("aiProvider", "gemini")
    url = ""
    web_context = fetch_web_context(handle)
    
    print(f"DEBUG: AI Research for @{handle}")
    print(f"DEBUG: Web Context: {web_context[:500]}...") # Log first 500 chars of web context
    
    if provider == "ollama":
        url = "http://localhost:11434/api/chat" # Ollama endpoint
        model = config['aiModel'] # Use the configured Ollama model
    else:
        url = f"https://generativelanguage.googleapis.com/v1/models/{config['aiModel']}:generateContent?key={config['aiApiKey']}"
        model = config['aiModel']

    prompt = (
        f"CONTEXT: Instagram metrics for @{handle}.\n"
        f"SEARCH_DATA: {web_context if web_context else 'None'}\n\n"
        "INSTRUCTIONS: Extract followers and postCount. IG post counts almost never exceed 60,000. "
        "If the search data is thin, do not hallucinate large numbers for posts.\n\n"
        "TASK:\n"
        "1. Extract 'followers' (e.g., 660M, 500K).\n"
        "2. Extract 'postCount'. If the number is in Millions/Billions, it is likely the follower count; "
        "set postCount to 'unknown' instead of using that number.\n"
        "3. Use internal knowledge if SEARCH_DATA is missing, but add '[Static]' to the name.\n"
        "4. Output valid JSON only.\n\n"
        "JSON SCHEMA: {\"followers\": \"string\", \"postCount\": \"string\", \"name\": \"string\", \"posts\": []}"
    )

    try:
        if provider == "ollama":
            payload = {
                "model": model, # Use the configured Ollama model
                "messages": [
                    {"role": "system", "content": "You are a data extraction agent. You must output valid JSON. Always distinguish between Followers (large) and Posts (small). Never report billions of posts."},
                    {"role": "user", "content": prompt}
                ],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1, "seed": 42} # Reduce randomness for factual responses
            }
        else:
            payload = { # Gemini payload already includes google_search tool
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {} # JSON mode is currently incompatible with Google Search tool
            }

        data = json.dumps(payload).encode("utf-8")
        req = Request(url, data=data, headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=120) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            if provider == "ollama":
                text = res.get("message", {}).get("content", "{}")
            else:
                if "error" in res:
                    raise Exception(res["error"].get("message", "Gemini API Error"))
                text = res["candidates"][0]["content"]["parts"][0]["text"]

            print(f"DEBUG: Raw AI Response for @{handle}: {text[:500]}...") # Log raw AI response

            # Robust JSON extraction: find the first { and last }
            json_match = re.search(r"(\{.*\})", text, re.S)
            if json_match:
                text = json_match.group(1)
            else:
                print(f"DEBUG: No valid JSON found in AI response for @{handle}. Defaulting to empty JSON.")
                text = "{}"
            
            ai_data = json.loads(text)
            print(f"DEBUG: Parsed AI Data for @{handle}: {ai_data}")

            followers_parsed = parse_count(ai_data.get("followers"))
            post_count_parsed = parse_count(ai_data.get("postCount"), is_post_count=True)
            print(f"DEBUG: Parsed Followers: {followers_parsed}, Parsed Post Count: {post_count_parsed}")

            return {
                "handle": handle,
                "ok": bool(followers_parsed), # Check if parsed followers is a valid number
                "followers": followers_parsed,
                "postCount": post_count_parsed,
                "name": ai_data.get("name"),
                "posts": [{"url": p["url"], "date": p["date"], "info": p["caption"], "links": []} for p in ai_data.get("posts", [])],
                "source": "ai",
                "message": "Researched using AI.",
                "researchedAt": datetime.now(timezone.utc).isoformat(),
                "researchOk": True
            }
    except (socket.timeout, TimeoutError):
        msg = "AI research timed out (120s). This usually happens during the initial model load. Try again."
        print(f"ERROR: {msg}")
        return {"handle": handle, "ok": False, "message": msg}
    except URLError as e:
        msg = "Ollama connection refused. Is the Ollama app running?" if provider == "ollama" else f"Network error: {str(e)}"
        print(f"ERROR: {msg}")
        return {"handle": handle, "ok": False, "message": msg}
    except json.JSONDecodeError as e:
        msg = f"AI returned invalid JSON: {e}. Raw response: {text[:200]}..."
        print(f"ERROR: {msg}")
        return {"handle": handle, "ok": False, "message": msg}
    except Exception as e:
        return {"handle": handle, "ok": False, "message": f"AI error: {str(e)}"}

def graph_research_account(handle, config):
    try:
        path = config["igUserId"]
        params = {
            "fields": f"business_discovery.username({handle}){{username,name,followers_count,media_count,media.limit(10){{permalink,caption,timestamp,media_type,media_url,like_count,comments_count}}}}"
        }
        data = graph_request(path, params, config)
        biz = data.get("business_discovery", {})
        
        if not biz:
            return {"handle": handle, "ok": False, "message": "Account not found via Graph API."}

        media = biz.get("media", {}).get("data", [])
        return {
            "handle": biz.get("username", handle),
            "ok": True,
            "name": biz.get("name"),
            "followers": biz.get("followers_count"),
            "postCount": biz.get("media_count"),
            "posts": [normalize_graph_post(p) for p in media],
            "source": "graph",
            "message": "Researched via Graph API Business Discovery.",
            "researchedAt": datetime.now(timezone.utc).isoformat()
        }
    except HTTPError as e:
        err_data = json.loads(e.read().decode("utf-8"))
        return {"handle": handle, "ok": False, "message": f"Graph error: {err_data.get('error', {}).get('message', str(e))}"}
    except Exception as e:
        return {"handle": handle, "ok": False, "message": f"Graph exception: {str(e)}"}

def research_influencer(value):
    account = resolve_account(value)
    if not account:
        return {"input": value, "ok": False, "message": "Invalid handle."}
    
    config = read_graph_config(include_token=True)
    result = {"ok": False, "message": "Graph API not configured."}

    if config.get("igUserId") and config.get("accessToken"):
        result = graph_research_account(account["handle"], config)

    if not result.get("ok") and config.get("aiEnabled"):
        ai_res = ai_research_account(account["handle"], config)
        if ai_res.get("ok"):
            return ai_res
        
        # If AI failed too, return the AI error object so the UI shows the fallback attempt
        ai_res["message"] = f"Graph: {result.get('message', 'Error')} | AI: {ai_res.get('message', 'Error')}"
        return ai_res

    return result

def check_link(value):
    url = normalize_url(value)
    if not url:
        return {
            "url": value,
            "ok": False,
            "status": None,
            "finalUrl": None,
            "message": "Invalid URL format",
        }

    for method in ("HEAD", "GET"):
        request = Request(url, method=method, headers={"User-Agent": "InstaListLinkChecker/1.0"})
        try:
            with urlopen(request, timeout=9, context=ssl.create_default_context()) as response:
                status = response.getcode()
                return {
                    "url": url,
                    "ok": 200 <= status < 400,
                    "status": status,
                    "finalUrl": response.geturl(),
                    "message": "Working" if 200 <= status < 400 else f"Returned HTTP {status}",
                }
        except HTTPError as error:
            if method == "HEAD" and error.code in (403, 405):
                continue
            return {
                "url": url,
                "ok": False,
                "status": error.code,
                "finalUrl": error.url,
                "message": f"Returned HTTP {error.code}",
            }
        except (URLError, TimeoutError, socket.timeout):
            if method == "HEAD":
                continue
            return {
                "url": url,
                "ok": False,
                "status": None,
                "finalUrl": None,
                "message": "Could not be reached",
            }

    return {
        "url": url,
        "ok": False,
        "status": None,
        "finalUrl": None,
        "message": "Could not be reached",
    }


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(min(length, 1_000_000)).decode("utf-8")
        return json.loads(raw or "{}")

    def do_GET(self):
        if self.path == "/api/history":
            self.send_json(200, read_history())
            return
        if self.path == "/api/graph-config":
            self.send_json(200, read_graph_config(include_token=False))
            return
        super().do_GET()

    def do_POST(self):
        try:
            if self.path == "/api/history":
                entry = self.read_json()
                history = read_history()
                saved = {
                    "id": str(uuid.uuid4()),
                    "savedAt": datetime.now(timezone.utc).isoformat(),
                    **entry,
                }
                history.insert(0, saved)
                write_history(history[:100])
                self.send_json(201, saved)
                return

            if self.path == "/api/graph-config":
                self.send_json(200, write_graph_config(self.read_json()))
                return

            if self.path == "/api/check-links":
                body = self.read_json()
                links = body.get("links") if isinstance(body, dict) else []
                unique_links = list(dict.fromkeys(links if isinstance(links, list) else []))
                self.send_json(200, {"results": [check_link(link) for link in unique_links]})
                return

            if self.path == "/api/research":
                body = self.read_json()
                influencers = body.get("influencers") if isinstance(body, dict) else []
                raw_list = influencers if isinstance(influencers, list) else []
                unique_map = {}
                for item in raw_list:
                    h = extract_handle(item)
                    if h and h not in unique_map:
                        unique_map[h] = item
                results = []
                config = read_graph_config(include_token=True)
                delay = 0.2 if config.get("aiProvider") == "ollama" else 1.0
                for h in unique_map.keys():
                    results.append(research_influencer(h))
                    time.sleep(delay) # Adjusted delay based on provider
                self.send_json(200, {"results": results})
                return

            self.send_json(404, {"error": "Not found"})
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def end_headers(self):
        if self.path.endswith(".js"):
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
        elif self.path.endswith(".css"):
            self.send_header("Content-Type", "text/css; charset=utf-8")
        super().end_headers()


def main():
    mimetypes.add_type("text/javascript", ".js")
    ensure_data_store()
    try:
        server = ThreadingHTTPServer(("localhost", PORT), AppHandler)
        print(f"Insta List is running at http://localhost:{PORT}")
        server.serve_forever()
    except OSError as e:
        if e.errno in (98, 10048):
            print(f"ERROR: Port {PORT} is already in use. Please close any other running terminal/server first.")
        else:
            print(f"ERROR: Could not start server: {e}")
        time.sleep(5)


if __name__ == "__main__":
    main()
