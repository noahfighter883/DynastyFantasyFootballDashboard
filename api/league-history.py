"""
Vercel serverless entry point: GET /api/league-history?league_id=...

Thin HTTP wrapper around DynastyLeagueDataFetcher.build_league_history --
all the actual season-chain-walking/aggregation logic lives there so the
CLI script and this endpoint stay in sync.
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
    build_league_history,
)

# Most of this payload is immutable past seasons, so it's safe to cache far
# longer at the CDN than the current-season league endpoint.
CACHE_CONTROL = "public, s-maxage=21600, stale-while-revalidate=86400"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        league_id = (query.get("league_id") or [""])[0].strip()

        if not league_id:
            self._send_json(400, {"error": "Missing required query param 'league_id'."})
            return

        try:
            data = build_league_history(league_id)
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
            print(f"Unexpected error building league history for league_id={league_id!r}: {e}")
            self._send_json(500, {"error": "Unexpected error building league history. Please try again."})
            return

        self._send_json(200, data, cache=True)

    def _send_json(self, status, payload, cache=False):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", CACHE_CONTROL if cache else "no-store")
        self.end_headers()
        self.wfile.write(body)
