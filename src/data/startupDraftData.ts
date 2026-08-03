export interface StartupDraftPick {
  player_id: string
  name: string
  position: 'QB' | 'RB' | 'WR' | 'TE'
  nfl_team: string | null
  round: number
  pick_in_round: number | null
  original_pick_no: number
  dynasty_overall_rank: number | null
  cohort_rank: number | null
  movement: number | null
  age_at_draft: number | null
  age_now: number | null
  drafted_by_team_name: string | null
  current_team_name: string | null
}

export interface ApiStartupDraftPayload {
  league_id: string
  season: string | null
  has_startup_draft: boolean
  teams: number | null
  picks: StartupDraftPick[]
}
