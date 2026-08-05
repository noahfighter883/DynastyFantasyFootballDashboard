import { DEMO_LEAGUE } from './leagueData'
import type { ApiLeagueHistoryPayload, OwnerHistory, SeasonRecord } from './leagueHistoryData'
import { seededRand, seededShuffle } from './seededRandom'

const DEMO_SEASONS = ['2023', '2024', '2025']
const PLAYOFF_TEAMS = 6

const teamIds = DEMO_LEAGUE.map((t) => t.id)

function buildSeasonRecords(): Record<string, SeasonRecord[]> {
  const perOwner: Record<string, SeasonRecord[]> = {}
  DEMO_LEAGUE.forEach((t) => {
    perOwner[t.id] = []
  })

  DEMO_SEASONS.forEach((season) => {
    // Two independent shuffles: final standing and regular-season-only rank
    // aren't always the same team (a #1 seed can still lose in the
    // playoffs), matching how the real league-history data models it.
    const placementOrder = seededShuffle(teamIds, seededRand(`placement:${season}`))
    const regSeasonOrder = seededShuffle(teamIds, seededRand(`regseason:${season}`))

    placementOrder.forEach((teamId, idx) => {
      const placement = idx + 1
      const regularSeasonRank = regSeasonOrder.indexOf(teamId) + 1
      const jitter = seededRand(`jitter:${season}:${teamId}`)
      const wins = Math.max(2, Math.min(12, Math.round(12 - placement + (jitter() * 2 - 1))))
      const losses = 13 - wins
      const basePts = 1550 - (placement - 6.5) * 22
      const pointsFor = Math.round(basePts + (jitter() * 60 - 30))
      const diff = Math.round((6.5 - placement) * 28 + (jitter() * 40 - 20))
      const pointsAgainst = Math.round(pointsFor - diff)
      const team = DEMO_LEAGUE.find((t) => t.id === teamId)!

      const record: SeasonRecord = {
        season,
        placement,
        wins,
        losses,
        ties: 0,
        points_for: pointsFor,
        points_against: pointsAgainst,
        point_differential: pointsFor - pointsAgainst,
        made_playoffs: placement <= PLAYOFF_TEAMS,
        playoff_team_count: PLAYOFF_TEAMS,
        regular_season_rank: regularSeasonRank,
        won_regular_season: regularSeasonRank === 1,
        team_name: team.name,
        trades: Math.floor(jitter() * 5),
        waiver_adds: Math.floor(jitter() * 8) + 1,
      }
      perOwner[teamId].push(record)
    })
  })

  return perOwner
}

function buildOwnerHistory(): OwnerHistory[] {
  const perOwner = buildSeasonRecords()
  return DEMO_LEAGUE.map((team) => {
    const seasons = perOwner[team.id]
    const placements = seasons.map((s) => s.placement).filter((p): p is number => p != null)
    const wins = seasons.reduce((s, r) => s + r.wins, 0)
    const losses = seasons.reduce((s, r) => s + r.losses, 0)
    const ties = seasons.reduce((s, r) => s + r.ties, 0)
    const points_for = seasons.reduce((s, r) => s + r.points_for, 0)
    const points_against = seasons.reduce((s, r) => s + r.points_against, 0)

    const owner: OwnerHistory = {
      owner_id: team.id,
      display_name: team.owner,
      team_name: team.name,
      seasons_played: seasons.length,
      championships: seasons.filter((s) => s.placement === 1).length,
      regular_season_titles: seasons.filter((s) => s.won_regular_season).length,
      playoff_appearances: seasons.filter((s) => s.made_playoffs).length,
      avg_finish: placements.length ? placements.reduce((a, b) => a + b, 0) / placements.length : null,
      best_finish: placements.length ? Math.min(...placements) : null,
      worst_finish: placements.length ? Math.max(...placements) : null,
      wins,
      losses,
      ties,
      points_for,
      points_against,
      point_differential: points_for - points_against,
      trades: seasons.reduce((s, r) => s + r.trades, 0),
      waiver_adds: seasons.reduce((s, r) => s + r.waiver_adds, 0),
      seasons,
    }
    return owner
  })
}

export const DEMO_LEAGUE_HISTORY: ApiLeagueHistoryPayload = {
  league_id: 'demo',
  seasons_included: DEMO_SEASONS,
  current_season_excluded: '2026',
  seasons_skipped_due_to_error: [],
  owners: buildOwnerHistory(),
}
