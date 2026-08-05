import { DEMO_LEAGUE } from './leagueData'
import type { ApiStartupDraftPayload, StartupDraftPick } from './startupDraftData'
import { seededRand } from './seededRandom'

const DRAFT_SEASON = '2023'
const TEAMS = 12

interface FlatPlayer {
  player_id: string
  name: string
  position: 'QB' | 'RB' | 'WR' | 'TE'
  nfl_team: string | null
  dynasty_overall_rank: number
  current_team_name: string
}

const flat: FlatPlayer[] = DEMO_LEAGUE.flatMap((team) =>
  team.players.map((p) => ({
    player_id: p.id,
    name: p.name,
    position: p.position,
    nfl_team: p.nflTeam,
    dynasty_overall_rank: p.dynastyOverallRank,
    current_team_name: team.name,
  }))
)

// Cohort rank: re-rank only these drafted players by current dynasty rank,
// same methodology as the real build_startup_draft_report -- apples-to-apples
// with the original pick number instead of the full league-wide rank.
const byRank = [...flat].sort((a, b) => a.dynasty_overall_rank - b.dynasty_overall_rank)
const cohortRankByPlayer = new Map(byRank.map((p, i) => [p.player_id, i + 1]))

const teamNames = DEMO_LEAGUE.map((t) => t.name)

// Original draft order: cohort rank plus a deterministic jitter, so the
// risers/fallers story isn't flatly zero for every player, then resolved
// into a real 1..N permutation by sort order.
const withOrder = flat
  .map((p) => {
    const cohortRank = cohortRankByPlayer.get(p.player_id)!
    const jitter = (seededRand(`draftorder:${p.player_id}`)() - 0.5) * flat.length * 0.6
    return { ...p, cohortRank, sortKey: cohortRank + jitter }
  })
  .sort((a, b) => a.sortKey - b.sortKey)

function draftedByFor(id: string): string {
  const i = Math.floor(seededRand(`draftedby:${id}`)() * teamNames.length)
  return teamNames[i]
}

function ageNowFor(id: string): number {
  return 22 + Math.floor(seededRand(`age:${id}`)() * 11)
}

const picks: StartupDraftPick[] = withOrder.map((p, idx) => {
  const original_pick_no = idx + 1
  const round = Math.ceil(original_pick_no / TEAMS)
  const pick_in_round = original_pick_no - (round - 1) * TEAMS
  const ageNow = ageNowFor(p.player_id)

  return {
    player_id: p.player_id,
    name: p.name,
    position: p.position,
    nfl_team: p.nfl_team,
    round,
    pick_in_round,
    original_pick_no,
    dynasty_overall_rank: p.dynasty_overall_rank,
    cohort_rank: p.cohortRank,
    movement: original_pick_no - p.cohortRank,
    age_at_draft: Math.max(20, ageNow - 3),
    age_now: ageNow,
    drafted_by_team_name: draftedByFor(p.player_id),
    current_team_name: p.current_team_name,
  }
})

export const DEMO_STARTUP_DRAFT: ApiStartupDraftPayload = {
  league_id: 'demo',
  season: DRAFT_SEASON,
  has_startup_draft: true,
  teams: TEAMS,
  picks,
}
