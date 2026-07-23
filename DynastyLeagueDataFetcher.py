"""
Dynasty League Data Fetcher
Pulls roster, user, and player data from the Sleeper API, dynasty and
redraft ADP from Fantasy Football Calculator, and season-long stat
projections from Sleeper's projections endpoint. Converts ADP into a
simple linear value score (value = totalPlayers - rank + 1), computes
each player's projected fantasy points using the league's actual scoring
settings (including TE premium), marks starters vs. bench, and produces:
  - Six team rankings: starters/full-roster x dynasty-value/redraft-value/projected-points
  - A per-position (QB/RB/WR/TE) breakdown for every team

Usage:
    python3 DynastyLeagueDataFetcher.py
"""

import csv
import io
import json
import math
import os
import time
import urllib.request

LEAGUE_ID = "1312205516633554944"
SEASON = "2026"

SLEEPER_BASE_URL = "https://api.sleeper.app/v1"
SLEEPER_PROJECTIONS_URL = (
    f"https://api.sleeper.com/projections/nfl/{SEASON}"
    "?season_type=regular&position[]=QB&position[]=RB&position[]=WR&position[]=TE"
)

PLAYERS_CACHE_FILE = "players_cache.json"
PLAYERS_CACHE_MAX_AGE_HOURS = 24

# Fantasy Football Calculator ADP endpoints (free, no auth, official JSON API).
# "dynasty" = startup dynasty ADP (whole-roster, not rookie-only).
# "ppr" = closest redraft-equivalent format to this league's scoring.
DYNASTYPROCESS_VALUES_URL = "https://raw.githubusercontent.com/DynastyProcess/data/master/files/values.csv"
DYNASTYPROCESS_FPECR_URL = "https://raw.githubusercontent.com/DynastyProcess/data/master/files/db_fpecr_latest.csv"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

SKILL_POSITIONS = ("QB", "RB", "WR", "TE")
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


# ---------------------------------------------------------------------------
# Fetch helpers
# ---------------------------------------------------------------------------

def fetch_json(url):
    req = urllib.request.Request(url, headers=REQUEST_HEADERS)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())


# ---------------------------------------------------------------------------
# Name normalization for matching across sources
# ---------------------------------------------------------------------------

def normalize_name(name):
    """
    Normalize a player name so it can be matched across Sleeper and FFC
    data, which format names slightly differently (periods, suffixes).
    e.g. "A.J. Brown" and "AJ Brown" both become "aj brown"
    """
    name = name.lower()
    name = name.replace(".", "").replace("'", "").replace("-", " ")
    tokens = [t for t in name.split() if t not in SUFFIXES]
    return " ".join(tokens)


# ---------------------------------------------------------------------------
# Sleeper data
# ---------------------------------------------------------------------------

def get_rosters():
    print("Fetching rosters...")
    return fetch_json(f"{SLEEPER_BASE_URL}/league/{LEAGUE_ID}/rosters")


def get_users():
    print("Fetching users...")
    return fetch_json(f"{SLEEPER_BASE_URL}/league/{LEAGUE_ID}/users")


def get_league_settings():
    print("Fetching league settings...")
    return fetch_json(f"{SLEEPER_BASE_URL}/league/{LEAGUE_ID}")


def get_league_chain():
    """
    Walks backward through previous_league_id to find every season's
    league_id in this league's full history, oldest first. Sleeper treats
    each season as a technically separate league, linked this way.
    """
    print("Walking league history (previous_league_id chain)...")
    chain = []
    current_id = LEAGUE_ID
    seen = set()
    while current_id and current_id not in seen:
        seen.add(current_id)
        chain.append(current_id)
        try:
            league = fetch_json(f"{SLEEPER_BASE_URL}/league/{current_id}")
        except Exception:
            break
        prev = league.get("previous_league_id")
        if not prev or prev == "0":
            break
        current_id = prev
    chain.reverse()  # oldest first
    print(f"  -> Found {len(chain)} season(s) in league history.")
    return chain


def get_owner_map_for_league(league_id):
    """
    Roster_id -> owner_id (user_id) mapping for one specific season.
    Roster_id numbering is reassigned independently each season, but
    owner_id (the actual manager) persists across seasons, so this is
    the key we track acquisition history against, not roster_id.
    """
    try:
        rosters = fetch_json(f"{SLEEPER_BASE_URL}/league/{league_id}/rosters")
    except Exception:
        return {}
    return {r.get("roster_id"): r.get("owner_id") for r in rosters if r.get("roster_id") is not None}


def get_draft_events_for_league(league_id, owner_map):
    """Returns a list of draft-pick events for one season, keyed by owner_id."""
    events = []
    try:
        drafts = fetch_json(f"{SLEEPER_BASE_URL}/league/{league_id}/drafts")
    except Exception:
        return events

    for d in drafts:
        draft_id = d.get("draft_id")
        try:
            picks = fetch_json(f"{SLEEPER_BASE_URL}/draft/{draft_id}/picks")
        except Exception:
            continue
        for pick in picks:
            pid = str(pick.get("player_id"))
            owner_id = owner_map.get(pick.get("roster_id"))
            if pid and owner_id:
                events.append({"type": "draft", "player_id": pid, "owner_id": owner_id, "week": -1})
    return events


def get_transaction_events_for_league(league_id, owner_map, max_week=18):
    """Returns a list of transaction add-events for one season, keyed by owner_id."""
    events = []
    for week in range(1, max_week + 1):
        try:
            txns = fetch_json(f"{SLEEPER_BASE_URL}/league/{league_id}/transactions/{week}")
        except Exception:
            continue
        if not txns:
            continue
        for txn in txns:
            if txn.get("status") != "complete":
                continue
            txn_type = txn.get("type")
            adds = txn.get("adds") or {}
            for pid, roster_id in adds.items():
                owner_id = owner_map.get(roster_id)
                if owner_id:
                    events.append({"type": txn_type, "player_id": str(pid), "owner_id": owner_id, "week": week})
    return events


def build_acquisition_history():
    """
    Walks the full league history (every season) and builds a
    player_id -> list of chronological acquisition events, each tagged
    with the owner_id who received the player and how (draft/trade/waiver).
    """
    league_chain = get_league_chain()

    all_events = []
    for season_order, league_id in enumerate(league_chain):
        owner_map = get_owner_map_for_league(league_id)
        draft_events = get_draft_events_for_league(league_id, owner_map)
        txn_events = get_transaction_events_for_league(league_id, owner_map)
        for e in draft_events + txn_events:
            e["season_order"] = season_order
        all_events.extend(draft_events)
        all_events.extend(txn_events)

    print(f"  -> {len(all_events)} total acquisition events across {len(league_chain)} season(s).")

    player_events = {}
    for e in all_events:
        player_events.setdefault(e["player_id"], []).append(e)
    return player_events


def determine_acquisition(pid, owner_id, player_events):
    """
    Determines how a player ended up on their CURRENT owner's roster: the
    most recent event (draft or transaction, across all of league history)
    that put them there. Returns None if no record exists (e.g. a
    commissioner-assigned player, or a gap in the historical data).
    """
    events = player_events.get(pid, [])
    matching = [e for e in events if e["owner_id"] == owner_id]
    if not matching:
        return None

    matching.sort(key=lambda e: (e["season_order"], e["week"]))
    latest = matching[-1]
    if latest["type"] == "draft":
        return "Drafted"
    if latest["type"] == "trade":
        return "Trade"
    if latest["type"] in ("waiver", "free_agent"):
        return "Waiver"
    return "Other"


def get_all_players():
    if os.path.exists(PLAYERS_CACHE_FILE):
        age_hours = (time.time() - os.path.getmtime(PLAYERS_CACHE_FILE)) / 3600
        if age_hours < PLAYERS_CACHE_MAX_AGE_HOURS:
            print(f"Using cached players file ({age_hours:.1f} hours old)...")
            with open(PLAYERS_CACHE_FILE, "r") as f:
                return json.load(f)

    print("Fetching full players reference file (~5MB, this may take a moment)...")
    players = fetch_json(f"{SLEEPER_BASE_URL}/players/nfl")
    with open(PLAYERS_CACHE_FILE, "w") as f:
        json.dump(players, f)
    return players


def get_season_projections():
    print("Fetching season-long projections...")
    data = fetch_json(SLEEPER_PROJECTIONS_URL)

    lookup = {}
    for entry in data:
        pid = str(entry.get("player_id"))
        stats = entry.get("stats") or {}
        if pid and stats:
            lookup[pid] = stats

    print(f"  -> {len(lookup)} players with projected stats.")
    return lookup


# ---------------------------------------------------------------------------
# Redraft consensus rank (DynastyProcess's FantasyPros ECR export)
# ---------------------------------------------------------------------------

def get_redraft_rankings():
    """
    Fetches DynastyProcess's db_fpecr_latest.csv and filters to the
    "redraft-overall" page for overall rank, plus the four position-specific
    pages (redraft-qb/rb/wr/te) for positional rank -- same source, same
    file, just different page_type values.

    Converts rank into the same linear value score used everywhere else:
        value = totalPlayers - rank + 1
    """
    print("Fetching redraft consensus ranks from DynastyProcess (GitHub)...")
    req = urllib.request.Request(DYNASTYPROCESS_FPECR_URL, headers=REQUEST_HEADERS)
    with urllib.request.urlopen(req) as response:
        text = response.read().decode()

    all_rows = list(csv.DictReader(io.StringIO(text)))

    # Overall rank (redraft-overall page)
    parsed = []
    for row in all_rows:
        if row.get("page_type") != "redraft-overall":
            continue
        name = row.get("player")
        ecr = row.get("ecr")
        if not name or not ecr:
            continue
        try:
            ecr = float(ecr)
        except ValueError:
            continue
        parsed.append({"name": name, "ecr": ecr})

    parsed.sort(key=lambda p: p["ecr"])
    total = len(parsed)
    lookup = {}
    for i, p in enumerate(parsed):
        rank = i + 1
        value = total - rank + 1
        key = normalize_name(p["name"])
        lookup[key] = {"value": value, "rank": rank, "position_rank": None}

    # Positional rank (redraft-qb / redraft-rb / redraft-wr / redraft-te pages)
    for pos in SKILL_POSITIONS:
        page_type = f"redraft-{pos.lower()}"
        pos_rows = []
        for row in all_rows:
            if row.get("page_type") != page_type:
                continue
            name = row.get("player")
            ecr = row.get("ecr")
            if not name or not ecr:
                continue
            try:
                ecr = float(ecr)
            except ValueError:
                continue
            pos_rows.append({"name": name, "ecr": ecr})

        pos_rows.sort(key=lambda p: p["ecr"])
        for i, p in enumerate(pos_rows):
            key = normalize_name(p["name"])
            if key in lookup:
                lookup[key]["position_rank"] = i + 1

    print(f"  -> {total} redraft consensus rank entries loaded (with positional rank).")
    return lookup


def get_dynasty_rankings():
    """
    Fetches DynastyProcess's open-data values.csv. Uses "ecr_1qb" (expert
    consensus rank) for overall rank, and "pos" + "ecr_pos" (the file's own
    positional consensus rank column) for positional rank -- both already
    present in this one file, no extra fetch needed.

    Converts overall rank into the same linear value score used everywhere:
        value = totalPlayers - rank + 1
    """
    print("Fetching dynasty consensus ranks from DynastyProcess (GitHub)...")
    req = urllib.request.Request(DYNASTYPROCESS_VALUES_URL, headers=REQUEST_HEADERS)
    with urllib.request.urlopen(req) as response:
        text = response.read().decode()

    reader = csv.DictReader(io.StringIO(text))
    parsed = []
    for row in reader:
        name = row.get("player")
        ecr = row.get("ecr_1qb")
        pos = row.get("pos")
        ecr_pos = row.get("ecr_pos")
        if not name or not ecr:
            continue
        try:
            ecr = float(ecr)
        except ValueError:
            continue
        try:
            ecr_pos = float(ecr_pos) if ecr_pos else None
        except ValueError:
            ecr_pos = None
        parsed.append({"name": name, "ecr": ecr, "pos": pos, "ecr_pos": ecr_pos})

    # Overall rank: sort by consensus rank ascending (lower ECR = better)
    parsed.sort(key=lambda p: p["ecr"])
    total = len(parsed)
    lookup = {}
    for i, p in enumerate(parsed):
        rank = i + 1
        value = total - rank + 1
        key = normalize_name(p["name"])
        lookup[key] = {"value": value, "rank": rank, "position_rank": None}

    # Positional rank: group by position, sort each group by ecr_pos ascending
    for pos in SKILL_POSITIONS:
        pos_group = [p for p in parsed if p["pos"] == pos and p["ecr_pos"] is not None]
        pos_group.sort(key=lambda p: p["ecr_pos"])
        for i, p in enumerate(pos_group):
            key = normalize_name(p["name"])
            if key in lookup:
                lookup[key]["position_rank"] = i + 1

    print(f"  -> {total} dynasty consensus rank entries loaded (with positional rank).")
    return lookup


# ---------------------------------------------------------------------------
# Fill gaps: assign fallback low ranks to unranked players
# ---------------------------------------------------------------------------

def fill_unmatched_with_low_values(adp_lookup, all_skill_player_names, label):
    """
    Any skill-position player not found in the ADP data gets assigned a
    sequential rank continuing right after the last real ADP entry, so
    they land distinctly at the bottom of the value scale rather than
    being left blank or all tied at the same number.
    """
    already_matched = set(adp_lookup.keys())
    missing = sorted(name for name in all_skill_player_names if normalize_name(name) not in already_matched)

    current_total = len(adp_lookup)
    new_total = current_total + len(missing)

    # Re-derive value using the new total so the whole scale stays consistent
    for key, info in adp_lookup.items():
        info["value"] = new_total - info["rank"] + 1

    for i, name in enumerate(missing):
        rank = current_total + i + 1
        value = new_total - rank + 1
        adp_lookup[normalize_name(name)] = {"value": value, "rank": rank, "position_rank": None}

    if missing:
        print(f"  -> {len(missing)} {label} players had no ADP data; assigned fallback low ranks {current_total + 1}-{new_total}.")

    return adp_lookup


# ---------------------------------------------------------------------------
# Projected fantasy points, using the league's actual scoring settings
# ---------------------------------------------------------------------------

def compute_projected_points(stats, scoring_settings, position):
    if not stats:
        return None

    total = 0.0
    for stat_key, stat_value in stats.items():
        if stat_key == "bonus_rec_te":
            continue
        weight = scoring_settings.get(stat_key)
        if weight and isinstance(stat_value, (int, float)):
            total += stat_value * weight

    if position == "TE":
        te_bonus_per_rec = scoring_settings.get("bonus_rec_te", 0)
        receptions = stats.get("rec", 0) or 0
        total += receptions * te_bonus_per_rec

    return round(total, 2)


# ---------------------------------------------------------------------------
# Aggregation helpers
# ---------------------------------------------------------------------------

def sum_field(players_list, field):
    return round(sum(pl[field] for pl in players_list if pl.get(field) is not None), 2)


def avg_field(players_list, field):
    """
    Average of a field across a group of players (e.g. average dynasty
    rank). Used instead of summing so team size / bench depth doesn't
    inflate the number -- lower average rank = better team.
    """
    values = [pl[field] for pl in players_list if pl.get(field) is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def format_round_pick(avg_rank, teams=12):
    """
    Converts an overall rank (or average rank) into standard fantasy
    draft "round.pick" notation, e.g. 51 -> "5.3" (5th round, 3rd pick),
    24 -> "2.12" (2nd round, 12th pick), based on a 12-team snake draft.
    """
    if avg_rank is None:
        return None
    round_num = math.ceil(avg_rank / teams)
    pick_in_round = avg_rank - (round_num - 1) * teams
    pick_int = max(1, min(teams, round(pick_in_round)))
    return f"{round_num}.{pick_int}"


def build_position_breakdown(players_list):
    breakdown = {}
    for pos in SKILL_POSITIONS:
        pos_players = [pl for pl in players_list if pl["position"] == pos]
        dynasty_avg = avg_field(pos_players, "dynasty_overall_rank")
        redraft_avg = avg_field(pos_players, "redraft_overall_rank")
        breakdown[pos] = {
            "count": len(pos_players),
            "dynasty_avg_rank": dynasty_avg,
            "dynasty_avg_rank_display": format_round_pick(dynasty_avg),
            "redraft_avg_rank": redraft_avg,
            "redraft_avg_rank_display": format_round_pick(redraft_avg),
            "projected_points": avg_field(pos_players, "projected_points"),
        }
    return breakdown


# ---------------------------------------------------------------------------
# Main join
# ---------------------------------------------------------------------------

def build_joined_dataset():
    rosters = get_rosters()
    users = get_users()
    settings = get_league_settings()
    players = get_all_players()
    dynasty_adp = get_dynasty_rankings()
    redraft_adp = get_redraft_rankings()
    projections = get_season_projections()
    print("Fetching acquisition history across all seasons...")
    player_events = build_acquisition_history()

    scoring_settings = settings.get("scoring_settings", {})

    # Collect every skill-position player name across all rosters so we can
    # backfill anyone missing from the ADP data with a fallback low rank.
    all_skill_names = set()
    for roster in rosters:
        for pid in (roster.get("players") or []):
            p = players.get(pid, {})
            if p.get("position") in SKILL_POSITIONS:
                full_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
                if full_name:
                    all_skill_names.add(full_name)

    dynasty_adp = fill_unmatched_with_low_values(dynasty_adp, all_skill_names, "dynasty")
    redraft_adp = fill_unmatched_with_low_values(redraft_adp, all_skill_names, "redraft")

    user_map = {}
    for u in users:
        team_name = None
        if u.get("metadata"):
            team_name = u["metadata"].get("team_name")
        user_map[u["user_id"]] = {
            "display_name": u.get("display_name"),
            "team_name": team_name or u.get("display_name"),
        }

    unmatched_value = set()
    unmatched_projection = set()
    joined_teams = []

    for roster in rosters:
        owner_id = roster.get("owner_id")
        owner_info = user_map.get(owner_id, {"display_name": "Unknown", "team_name": "Unknown"})
        roster_id = roster.get("roster_id")

        player_ids = roster.get("players") or []
        starter_ids = set(roster.get("starters") or [])

        roster_players = []
        for pid in player_ids:
            p = players.get(pid, {})
            full_name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or "Unknown"
            position = p.get("position")
            name_key = normalize_name(full_name)

            dynasty_info = dynasty_adp.get(name_key)
            redraft_info = redraft_adp.get(name_key)
            player_stats = projections.get(pid)
            projected_points = compute_projected_points(player_stats, scoring_settings, position)
            acquisition_type = determine_acquisition(pid, owner_id, player_events)

            is_skill_position = position in SKILL_POSITIONS
            if dynasty_info is None and redraft_info is None and is_skill_position:
                unmatched_value.add(full_name)
            if projected_points is None and is_skill_position:
                unmatched_projection.add(full_name)

            roster_players.append({
                "player_id": pid,
                "name": full_name,
                "position": position,
                "team": p.get("team"),
                "is_starter": pid in starter_ids,
                "dynasty_value": dynasty_info["value"] if dynasty_info else None,
                "dynasty_overall_rank": dynasty_info["rank"] if dynasty_info else None,
                "dynasty_position_rank": dynasty_info.get("position_rank") if dynasty_info else None,
                "redraft_value": redraft_info["value"] if redraft_info else None,
                "redraft_overall_rank": redraft_info["rank"] if redraft_info else None,
                "redraft_position_rank": redraft_info.get("position_rank") if redraft_info else None,
                "projected_points": projected_points,
                "projected_position_rank": None,  # filled in after all teams are built
                "acquisition_type": acquisition_type,
            })

        starters = [pl for pl in roster_players if pl["is_starter"]]
        skill_roster = [pl for pl in roster_players if pl["position"] in SKILL_POSITIONS]
        skill_starters = [pl for pl in starters if pl["position"] in SKILL_POSITIONS]

        starters_dynasty_avg = avg_field(starters, "dynasty_overall_rank")
        starters_redraft_avg = avg_field(starters, "redraft_overall_rank")
        roster_dynasty_avg = avg_field(roster_players, "dynasty_overall_rank")
        roster_redraft_avg = avg_field(roster_players, "redraft_overall_rank")

        team_totals = {
            "starters_dynasty_avg_rank": starters_dynasty_avg,
            "starters_dynasty_avg_rank_display": format_round_pick(starters_dynasty_avg),
            "starters_redraft_avg_rank": starters_redraft_avg,
            "starters_redraft_avg_rank_display": format_round_pick(starters_redraft_avg),
            "starters_projected_points": avg_field(starters, "projected_points"),
            "roster_dynasty_avg_rank": roster_dynasty_avg,
            "roster_dynasty_avg_rank_display": format_round_pick(roster_dynasty_avg),
            "roster_redraft_avg_rank": roster_redraft_avg,
            "roster_redraft_avg_rank_display": format_round_pick(roster_redraft_avg),
            "roster_projected_points": avg_field(roster_players, "projected_points"),
        }

        joined_teams.append({
            "roster_id": roster.get("roster_id"),
            "owner": owner_info["display_name"],
            "team_name": owner_info["team_name"],
            "totals": team_totals,
            "position_breakdown_roster": build_position_breakdown(skill_roster),
            "position_breakdown_starters": build_position_breakdown(skill_starters),
            "players": roster_players,
        })

    # Projected-points positional rank: computed entirely from our own data
    # (no external source needed). Rank every rostered player at each
    # position by their own projected_points, across the whole league.
    for pos in SKILL_POSITIONS:
        pos_players = [
            pl
            for team in joined_teams
            for pl in team["players"]
            if pl["position"] == pos and pl["projected_points"] is not None
        ]
        pos_players.sort(key=lambda pl: pl["projected_points"], reverse=True)
        for i, pl in enumerate(pos_players):
            pl["projected_position_rank"] = i + 1

    rankings = {}
    ascending_metrics = {
        "starters_dynasty_avg_rank",
        "starters_redraft_avg_rank",
        "roster_dynasty_avg_rank",
        "roster_redraft_avg_rank",
    }
    for metric in [
        "starters_dynasty_avg_rank",
        "starters_redraft_avg_rank",
        "starters_projected_points",
        "roster_dynasty_avg_rank",
        "roster_redraft_avg_rank",
        "roster_projected_points",
    ]:
        is_ascending = metric in ascending_metrics
        ranked = sorted(joined_teams, key=lambda t: t["totals"][metric], reverse=not is_ascending)
        display_key = f"{metric}_display"
        rankings[metric] = [
            {
                "rank": i + 1,
                "team_name": t["team_name"],
                "owner": t["owner"],
                "value": t["totals"][metric],
                "display": t["totals"].get(display_key),
            }
            for i, t in enumerate(ranked)
        ]

    output = {
        "league_id": LEAGUE_ID,
        "scoring_settings": scoring_settings,
        "teams": joined_teams,
        "rankings": rankings,
    }

    with open("joined_league_data.json", "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone. Wrote joined_league_data.json with {len(joined_teams)} teams.")

    if unmatched_value:
        print(f"\n{len(unmatched_value)} skill-position players had no ADP match (name mismatch likely):")
        for name in sorted(unmatched_value):
            print(f"  - {name}")

    if unmatched_projection:
        print(f"\n{len(unmatched_projection)} skill-position players had no projection:")
        for name in sorted(unmatched_projection):
            print(f"  - {name}")

    print("\n--- Team Rankings ---")
    print("(For avg_rank metrics: lower is better, like golf. For projected_points: higher is better.)")
    for metric, ranked_list in rankings.items():
        print(f"\n{metric}:")
        for entry in ranked_list:
            display_suffix = f" ({entry['display']})" if entry.get("display") else ""
            print(f"  {entry['rank']}. {entry['team_name']} — {entry['value']}{display_suffix}")

    print("\nNext step: review, then regenerate leagueData.ts from this file.")


if __name__ == "__main__":
    build_joined_dataset()