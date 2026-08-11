"""
Vercel serverless entry point: GET /api/league?league_id=...[&season=...]

`season` is optional -- when omitted, build_joined_dataset() derives it from
the league's own Sleeper settings, which is what every real caller wants.

Thin HTTP wrapper around DynastyLeagueDataFetcher.build_joined_dataset --
all the actual data fetching/joining logic lives there so the CLI script
and this endpoint stay in sync.
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
    build_joined_dataset,
    check_rate_limit,
)

# CDN-level cache: fresh for 30 min, served stale (while revalidating in the
# background) for up to another hour. This is the whole per-league caching
# layer for now -- no separate KV store needed for v1.
CACHE_CONTROL = "public, s-maxage=1800, stale-while-revalidate=3600"


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            check_rate_limit(f"league:{self._client_ip()}")
        except RateLimitError as e:
            self._send_json(429, {"error": str(e)})
            return

        query = parse_qs(urlparse(self.path).query)
        league_id = (query.get("league_id") or [""])[0].strip()
        # None (not a hardcoded default) so build_joined_dataset falls back
        # to the league's own reported season instead of always assuming
        # whatever year this file was written in.
        season = (query.get("season") or [None])[0]
        season = season.strip() if season else None

        if not league_id:
            self._send_json(400, {"error": "Missing required query param 'league_id'."})
            return

        try:
            data, unmatched_value, unmatched_projection = build_joined_dataset(league_id, season)
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
            # Logged server-side (Vercel captures stdout/stderr in function
            # logs) but not reflected to the client, which could otherwise
            # leak internal details (paths, module names) for no benefit.
            print(f"Unexpected error building league data for league_id={league_id!r}: {e}")
            self._send_json(500, {"error": "Unexpected error building league data. Please try again."})
            return

        data["unmatched_value_names"] = sorted(unmatched_value)
        data["unmatched_projection_names"] = sorted(unmatched_projection)
        self._send_json(200, data, cache=True)

    def _client_ip(self):
        # Vercel puts the real client IP first in X-Forwarded-For (it
        # terminates the connection itself, so self.client_address is
        # always Vercel's own proxy, not the caller).
        forwarded = self.headers.get("x-forwarded-for", "")
        return forwarded.split(",")[0].strip() or self.client_address[0]

    def _send_json(self, status, payload, cache=False):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        # Explicit either way -- a transient failure (e.g. Sleeper being
        # briefly down) must never get cached and served to other users.
        self.send_header("Cache-Control", CACHE_CONTROL if cache else "no-store")
        if status == 429:
            self.send_header("Retry-After", "60")
        self.end_headers()
        self.wfile.write(body)
