# DynastyEvaluator

A dynasty fantasy football analytics dashboard that answers the question every dynasty manager eventually asks: *if my league re-drafted from scratch today, how would every team actually stack up?*

**[Live app →](https://dynasty-fantasy-football-dashboard.vercel.app/)**

> This branch (`multi-league-support`) adds the ability for **anyone to paste their own Sleeper league ID or URL** and get the same dashboard for their league, via a live `/api/league` endpoint, rather than the tool only working for one hardcoded league. Not yet merged to `main`.

Paste any Sleeper dynasty league's ID or URL to compare all of that league's teams across three lenses: long-term dynasty value, this-year redraft value, and projected points. Only QB/RB/WR/TE are covered for now — kickers, defenses, and IDP are ignored.

---

## Features

- **Bring your own league** — enter a Sleeper league ID or URL and the dashboard generates itself for that league; a demo league is available if you just want to look around first
- **League Overview** — every team ranked against each other, toggleable by dynasty value, redraft value, or projected points, and by starters, "starters +1," or full roster
- **Position Comparison** — isolate a single position (QB/RB/WR/TE) and rank every team's strength at just that spot
- **Team Detail** — full roster breakdown, position-by-position cards, and a custom **Draft Capital Curve** chart plotting every player's dynasty and redraft rank, sorted best to worst
- **"Starters +1"** — a dynamic view showing each team's real starters plus the single best bench player per position, re-selected depending on which value lens you're viewing, using each league's actual starting lineup sizes (not assumed positions counts)

## How it works

A Python pipeline (`DynastyLeagueDataFetcher.py`) pulls and joins data from several sources, callable either as a CLI script (writes `joined_league_data.json`) or as the `GET /api/league?league_id=...` Vercel serverless function the frontend calls live:

- **[Sleeper API](https://docs.sleeper.com/)** — live rosters, starters, and league scoring settings for whatever league ID is requested; no login or API key needed, Sleeper league data is public by ID
- **[DynastyProcess](https://github.com/dynastyprocess/data)** — open dynasty and redraft player rankings, including positional ranks
- Season-long **projected points**, calculated directly from the league's actual scoring settings (including a TE premium)

Team-level "value" is an **average-rank system** (lower average rank = better team — the same logic as golf scoring) rather than a raw sum, so a team's score reflects player quality regardless of roster size. Round.pick notation (e.g. `3.3`) is computed from the league's actual number of teams, not a fixed assumption.

The frontend is a React app that fetches the joined dataset per-league and renders the views described above, including a hand-built SVG chart (no charting library) for the Draft Capital Curve.

## Tech stack

- **Data pipeline / API:** Python (stdlib only, no third-party deps), deployed as a Vercel serverless function
- **Frontend:** React, TypeScript
- **Hosting:** Vercel
- Built with [Figma Make](https://www.figma.com/make/), with development assistance from [Claude](https://claude.ai) (Anthropic)

## Data freshness

Each league's data is fetched live on request and cached for ~30 minutes (CDN-level, via `Cache-Control`) before the next request re-fetches it.

---

For the full design and development write-up, see the [case study](https://docs.google.com/document/d/1v4rfBSqaF5nmowVKRmxNKL_kPNIwkNxsbRgzvZigyEk/edit?usp=sharing).
