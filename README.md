# DynastyEvaluator

A dynasty fantasy football analytics dashboard that answers the questions every dynasty manager eventually asks: *if my league re-drafted from scratch today, how would every team actually stack up? How did my draft picks pan out? Who's actually run this league the best?*

**[Live app →](https://dynasty-fantasy-football-dashboard.vercel.app/)**

Enter your Sleeper username, or paste any Sleeper dynasty league's ID or URL, to generate power rankings, position breakdowns, feasibility checks, multi-season history, and a full startup-draft retrospective for that league. Only QB/RB/WR/TE are covered for now — kickers, defenses, and IDP are ignored.

---

## Features

- **Bring your own league** — enter your Sleeper username (you'll get a picker if you're in more than one league), or a league ID/URL directly, and the dashboard generates itself; a demo league is available if you just want to look around first
- **League Overview** — every team ranked against each other, toggleable by dynasty value, redraft value, or projected points, and by starters, "starters +1," or full roster
- **Position Comparison** — isolate a single position (QB/RB/WR/TE) and rank every team's strength at just that spot
- **Feasibility** — for each team, a snake-draft plausibility score: how hard would it be to explain this exact roster as the outcome of one ordinary draft, versus one built through unusually lopsided trades or waiver activity?
- **Team Detail** — full roster breakdown, position-by-position cards, a custom **Draft Capital Curve** chart plotting every player's dynasty and redraft rank sorted best to worst, and an **Acquired** column tracking how every player joined the roster (startup draft slot, rookie draft slot, trade, or waiver + FAAB spent) — including a best-effort inference from a previous owner when a roster has changed hands
- **League History** — all-time standings across every completed season: average finish, championships, regular-season #1 seeds, playoff appearances, record, point differential, trades, and waiver pickups, sortable and with a show/hide-columns toggle, plus a year-by-year drill-down per owner
- **Startup Draft** — every skill-position player from the league's original startup draft, showing where they were picked, their current dynasty rank, a cohort-adjusted rank (re-ranked against only the other startup-drafted players, for an apples-to-apples comparison with the original pick number), how far they've risen or fallen, age then vs. now, and who drafted/currently owns them — with a Biggest Risers / Biggest Fallers callout, position filters, and search
- **"Starters +1"** — a dynamic view showing each team's real starters plus the single best bench player per position, re-selected depending on which value lens you're viewing, using each league's actual starting lineup sizes (not assumed position counts)
- **Demo league** — a frozen snapshot of a real league's current rosters, so you can explore every screen without entering your own; League History and Startup Draft in demo mode fetch live from that same real league, so even the demo's multi-season history and draft data are real, not fabricated

## How it works

A Python pipeline (`DynastyLeagueDataFetcher.py`) pulls and joins data from several sources, callable either as a CLI script (writes `joined_league_data.json`) or via Vercel serverless functions the frontend calls live:

| Endpoint | Purpose |
|---|---|
| `GET /api/league?league_id=...` | Current rosters, rankings, and feasibility for a known league |
| `GET /api/username?username=...` | Every league a Sleeper username is in (used when you don't have the league ID handy) |
| `GET /api/league-history?league_id=...` | All-time standings, walking every past season via Sleeper's `previous_league_id` chain |
| `GET /api/startup-draft?league_id=...` | The resolved startup draft, cohort rankings, and movement for every pick |
| `GET /api/acquisitions?league_id=...` | Per-player acquisition type (startup/rookie draft, trade, waiver) for the Team Detail Acquired column |

- **[Sleeper API](https://docs.sleeper.com/)** — live rosters, starters, league scoring settings, transaction history, and draft results for whatever league ID is requested; no login or API key needed, Sleeper league data is public by ID
- **[DynastyProcess](https://github.com/dynastyprocess/data)** — open dynasty and redraft player rankings, including positional ranks
- Season-long **projected points**, calculated directly from the league's actual scoring settings (including a TE premium)

Team-level "value" is an **average-rank system** (lower average rank = better team — the same logic as golf scoring) rather than a raw sum, so a team's score reflects player quality regardless of roster size. Round.pick notation (e.g. `3.3`) is computed from the league's actual number of teams, not a fixed assumption. League History and the Startup Draft's acquisition tracking both walk Sleeper's full season chain and transaction log, so ownership changes (a roster traded/sold to a new manager) are handled by attributing history to individual owners rather than static roster slots, with an inferred fallback when a player's acquisition predates the current owner.

The frontend is a React app that fetches the relevant dataset(s) per screen and renders the views described above, including hand-built SVG charts (no charting library) for the Draft Capital Curve and Feasibility comparison.

## Tech stack

- **Data pipeline / API:** Python (stdlib only, no third-party deps), deployed as Vercel serverless functions
- **Frontend:** React, TypeScript, Vite
- **Hosting:** Vercel
- Built with [Figma Make](https://www.figma.com/make/), with development assistance from [Claude](https://claude.ai) (Anthropic)

## Data freshness

Current-season data (rosters, rankings, feasibility, acquisitions) is fetched live on request and cached for ~30 minutes (CDN-level, via `Cache-Control`) before the next request re-fetches it. League History, which only changes once a season actually ends, is cached for 6 hours.

---

For the full design and development write-up, see the [case study](https://docs.google.com/document/d/1v4rfBSqaF5nmowVKRmxNKL_kPNIwkNxsbRgzvZigyEk/edit?usp=sharing).
