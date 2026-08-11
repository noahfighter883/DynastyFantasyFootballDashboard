"""
Vercel serverless entry point: GET /api/username?username=...[&season=...]

Looks up every Sleeper league a username is in for a season, so the
frontend can either auto-load the one league found or let the user pick
between several, instead of requiring a league ID/URL up front.
"""

import json
import os
import sys
import urllib.error
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from DynastyLeagueDataFetcher import (  # noqa: E402
    InvalidInputError,
    RateLimitError,
    UserNotFoundError,
    check_rate_limit,
    find_leagues_for_username,
)

CACHE_CONTROL = "public, s-maxage=1800, stale-while-revalidate=3600"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            check_rate_limit(f"username:{self._client_ip()}")
        except RateLimitError as e:
            self._send_json(429, {"error": str(e)})
            return

        query = parse_qs(urlparse(self.path).query)
        username = (query.get("username") or [""])[0].strip()
        season = (query.get("season") or [None])[0]
        season = season.strip() if season else None

        if not username:
            self._send_json(400, {"error": "Missing required query param 'username'."})
            return

        try:
            leagues = find_leagues_for_username(username, season)
        except InvalidInputError as e:
            self._send_json(400, {"error": str(e)})
            return
        except UserNotFoundError as e:
            self._send_json(404, {"error": str(e)})
            return
        except urllib.error.HTTPError as e:
            self._send_json(502, {"error": f"Sleeper API error: HTTP {e.code}"})
            return
        except urllib.error.URLError as e:
            self._send_json(502, {"error": f"Could not reach Sleeper API: {e.reason}"})
            return
        except Exception as e:
            print(f"Unexpected error looking up username={username!r}: {e}")
            self._send_json(500, {"error": "Unexpected error looking up username. Please try again."})
            return

        self._send_json(200, {"username": username, "leagues": leagues}, cache=True)

    def _client_ip(self):
        forwarded = self.headers.get("x-forwarded-for", "")
        return forwarded.split(",")[0].strip() or self.client_address[0]

    def _send_json(self, status, payload, cache=False):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # Explicit either way -- a transient failure must never get cached
        # and served to other users.
        self.send_header("Cache-Control", CACHE_CONTROL if cache else "no-store")
        if status == 429:
            self.send_header("Retry-After", "60")
        self.end_headers()
        self.wfile.write(body)
