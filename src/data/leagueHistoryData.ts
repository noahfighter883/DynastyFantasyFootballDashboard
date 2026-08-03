export interface SeasonRecord {
  season: string
  placement: number | null
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  point_differential: number
  made_playoffs: boolean
  playoff_team_count: number
  regular_season_rank: number | null
  won_regular_season: boolean
  team_name: string
  trades: number
  waiver_adds: number
}

export interface OwnerHistory {
  owner_id: string
  display_name: string
  team_name: string
  seasons_played: number
  championships: number
  regular_season_titles: number
  playoff_appearances: number
  avg_finish: number | null
  best_finish: number | null
  worst_finish: number | null
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  point_differential: number
  trades: number
  waiver_adds: number
  seasons: SeasonRecord[]
}

export interface ApiLeagueHistoryPayload {
  league_id: string
  seasons_included: string[]
  current_season_excluded: string | null
  seasons_skipped_due_to_error: string[]
  owners: OwnerHistory[]
}
