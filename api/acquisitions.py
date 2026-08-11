"""
Vercel serverless entry point: GET /api/acquisitions?league_id=...

Thin HTTP wrapper around DynastyLeagueDataFetcher.build_acquisition_map --
all the actual season-chain-walking/matching logic lives there so the
CLI script and this endpoint stay in sync. Deliberately a separate,
lazily-called endpoint rather than folded into /api/league -- it's a full
history walk, and this app was previously bitten by exactly that combo
causing serverless timeouts on the main page load (see git history on
DynastyLeagueDataFetcher.py).
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
    LeagueNotFoundError,
    RateLimitError,
    build_acquisition_map,
    check_rate_limit,
)

# Includes the current (possibly still-active) season's transactions, so
# this needs the same freshness window as /api/league rather than league
# history's longer one.
CACHE_CONTROL = "public, s-maxage=1800, stale-while-revalidate=3600"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            check_rate_limit(f"acquisitions:{self._client_ip()}")
        except RateLimitError as e:
            self._send_json(429, {"error": str(e)})
            return

        query = parse_qs(urlparse(self.path).query)
        league_id = (query.get("league_id") or [""])[0].strip()

        if not league_id:
            self._send_json(400, {"error": "Missing required query param 'league_id'."})
            return

        try:
            data = build_acquisition_map(league_id)
        except InvalidInputError as e:
            self._send_json(400, {"error": str(e)})
            return
        except LeagueNotFoundError as e:
            self._send_json(404, {"error": str(e)})
            return
        except urllib.error.HTTPError as e:
            if e.code == 404:
                self._send_json(404, {"error": f"No Sleeper league found with id '{league_id}'."})
            else:
                self._send_json(502, {"error": f"Sleeper API error: HTTP {e.code}"})
            return
        except urllib.error.URLError as e:
            self._send_json(502, {"error": f"Could not reach Sleeper API: {e.reason}"})
            return
        except Exception as e:
            print(f"Unexpected error building acquisition map for league_id={league_id!r}: {e}")
            self._send_json(500, {"error": "Unexpected error building acquisition history. Please try again."})
            return

        self._send_json(200, data, cache=True)

    def _client_ip(self):
        forwarded = self.headers.get("x-forwarded-for", "")
        return forwarded.split(",")[0].strip() or self.client_address[0]

    def _send_json(self, status, payload, cache=False):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", CACHE_CONTROL if cache else "no-store")
        if status == 429:
            self.send_header("Retry-After", "60")
        self.end_headers()
        self.wfile.write(body)
