export type Position = 'QB' | 'RB' | 'WR' | 'TE'
export type AcquisitionType = 'Drafted' | 'Trade' | 'Waiver' | 'Other'

export interface Player {
  id: string
  name: string
  position: Position
  nflTeam: string
  isStarter: boolean
  dynastyValue: number
  dynastyOverallRank: number
  dynastyPositionRank: number | null
  redraftValue: number
  redraftOverallRank: number
  redraftPositionRank: number | null
  projectedPoints: number
  projectedPositionRank: number | null
  acquisitionType: AcquisitionType | null
}

export interface PositionTotals {
  dynastyStartersAvgRank: number | null
  dynastyStartersAvgRankDisplay: string | null
  dynastyRosterAvgRank: number | null
  dynastyRosterAvgRankDisplay: string | null
  dynastyPlus1AvgRank: number | null
  dynastyPlus1AvgRankDisplay: string | null
  redraftStartersAvgRank: number | null
  redraftStartersAvgRankDisplay: string | null
  redraftRosterAvgRank: number | null
  redraftRosterAvgRankDisplay: string | null
  redraftPlus1AvgRank: number | null
  redraftPlus1AvgRankDisplay: string | null
  projectedStarters: number | null
  projectedRoster: number | null
  projectedPlus1: number | null
}

export interface TeamTotals {
  overall: PositionTotals
  QB: PositionTotals
  RB: PositionTotals
  WR: PositionTotals
  TE: PositionTotals
}

export interface Team {
  id: string
  name: string
  owner: string
  players: Player[]
  totals: TeamTotals
}

export type SortScope = 'starters' | 'starters_plus1' | 'roster'
export type SortMetric = 'dynasty' | 'redraft' | 'projected'
export type Screen = 'overview' | 'team' | 'position'
