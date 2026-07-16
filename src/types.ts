export type Position = 'QB' | 'RB' | 'WR' | 'TE'

export interface Player {
  id: string
  name: string
  position: Position
  nflTeam: string
  isStarter: boolean
  dynastyValue: number
  dynastyOverallRank: number
  redraftValue: number
  redraftOverallRank: number
  projectedPoints: number
}

export interface PositionTotals {
  dynastyStarters: number
  dynastyRoster: number
  redraftStarters: number
  redraftRoster: number
  projectedStarters: number
  projectedRoster: number
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

export type SortScope = 'starters' | 'roster'
export type SortMetric = 'dynasty' | 'redraft' | 'projected'
export type Screen = 'overview' | 'team' | 'position'
