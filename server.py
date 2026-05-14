from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json
import mimetypes
import os
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
PORT = int(os.environ.get("PORT", "5173"))
HOST = os.environ.get("HOST", "0.0.0.0")

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
    }
    if include_token:
        return clean

    return {
        "apiVersion": clean["apiVersion"],
        "igUserId": clean["igUserId"],
        "configured": bool(clean["igUserId"] and clean["accessToken"]),
        "keywords": clean["keywords"],
        "tokenPreview": f"{clean['accessToken'][:6]}..." if clean["accessToken"] else "",
    }


def write_graph_config(config):
    ensure_data_store()
    previous = read_graph_config(include_token=True)
    cleaned = {
        "apiVersion": str(config.get("apiVersion") or previous.get("apiVersion") or "v25.0").strip().lstrip("/"),
        "igUserId": str(config.get("igUserId") or previous.get("igUserId") or "").strip(),
        "accessToken": str(config.get("accessToken") or previous.get("accessToken") or "").strip(),
        "keywords": str(config.get("keywords", previous.get("keywords", ""))).strip(),
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


def graph_request(path, params, config, token_index=0):
    # Split tokens to support rotation if user provides multiple (comma separated)
    tokens = [t.strip() for p in config["accessToken"].split(",") if (t := p.strip())]
    if not tokens:
        raise Exception("No Access Token configured.")
    
    # Wrap around if index exceeds length
    token = tokens[token_index % len(tokens)]
    
    query = urlencode({**params, "access_token": token})
    url = f"https://graph.facebook.com/{config['apiVersion']}/{path}?{query}"
    request = Request(url, headers={"User-Agent": "InstaListGraphClient/1.0"})
    
    try:
        with urlopen(request, timeout=25, context=ssl.create_default_context()) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as e:
        err_data = json.loads(e.read().decode("utf-8"))
        error_msg = err_data.get("error", {}).get("message", "")
        error_code = err_data.get("error", {}).get("code", 0)
        
        # Handle Rate Limiting (Error code 4 or 17)
        if (error_code == 4 or error_code == 17) and len(tokens) > 1 and token_index < len(tokens):
            print(f"DEBUG: Rate limit on token {token_index + 1}. Rotating...")
            return graph_request(path, params, config, token_index + 1)
        
        # If it's a rate limit and we have no more tokens, wait a bit if it's the first retry
        if (error_code == 4 or error_code == 17) and token_index == 0:
            print("DEBUG: Rate limit reached. Sleeping for 5s before fallback...")
            time.sleep(5)
            
        raise Exception(error_msg or str(e))



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
        return {"handle": value, "ok": False, "message": "Invalid handle."}

    config = read_graph_config(include_token=True)

    if config.get("igUserId") and config.get("accessToken"):
        try:
            return graph_research_account(account["handle"], config)
        except Exception as e:
            return {"handle": account["handle"], "ok": False, "message": str(e)}

    return {"handle": account["handle"], "ok": False, "message": "Graph API not configured."}

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
                for h in unique_map.keys():
                    results.append(research_influencer(h))
                    time.sleep(3.0) # Increased delay to avoid Meta Rate Limits
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
        server = ThreadingHTTPServer((HOST, PORT), AppHandler)
        display_host = "localhost" if HOST == "0.0.0.0" else HOST
        print(f"Insta List is running at http://{display_host}:{PORT}")
        server.serve_forever()
    except OSError as e:
        if e.errno in (98, 10048):
            print(f"ERROR: Port {PORT} is already in use. Please close any other running terminal/server first.")
        else:
            print(f"ERROR: Could not start server: {e}")
        time.sleep(5)


if __name__ == "__main__":
    main()
