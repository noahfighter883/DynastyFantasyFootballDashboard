import { useState, useMemo } from 'react'
import type { Team, SortScope, SortMetric, Position } from '../types'

interface Props {
  teams: Team[]
  onSelectTeam: (id: string) => void
}

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE']
const POS_COLORS: Record<Position, string> = {
  QB: '#818cf8',
  RB: '#34d399',
  WR: '#60a5fa',
  TE: '#fb923c',
}

// Dynasty/redraft are now "lower is better" (average draft-round rank,
// like golf). Projected points stays "higher is better".
function isAscendingMetric(metric: SortMetric): boolean {
  return metric === 'dynasty' || metric === 'redraft'
}

function getMetricValue(team: Team, scope: SortScope, metric: SortMetric): number {
  const t = team.totals.overall
  if (metric === 'dynasty') {
    if (scope === 'starters') return t.dynastyStartersAvgRank
    if (scope === 'starters_plus1') return t.dynastyPlus1AvgRank
    return t.dynastyRosterAvgRank
  }
  if (metric === 'redraft') {
    if (scope === 'starters') return t.redraftStartersAvgRank
    if (scope === 'starters_plus1') return t.redraftPlus1AvgRank
    return t.redraftRosterAvgRank
  }
  if (scope === 'starters') return t.projectedStarters
  if (scope === 'starters_plus1') return t.projectedPlus1
  return t.projectedRoster
}

// Round.pick display string (e.g. "3.3") for dynasty/redraft, null for projected points.
function getMetricDisplay(team: Team, scope: SortScope, metric: SortMetric): string | null {
  const t = team.totals.overall
  if (metric === 'dynasty') {
    if (scope === 'starters') return t.dynastyStartersAvgRankDisplay
    if (scope === 'starters_plus1') return t.dynastyPlus1AvgRankDisplay
    return t.dynastyRosterAvgRankDisplay
  }
  if (metric === 'redraft') {
    if (scope === 'starters') return t.redraftStartersAvgRankDisplay
    if (scope === 'starters_plus1') return t.redraftPlus1AvgRankDisplay
    return t.redraftRosterAvgRankDisplay
  }
  return null
}

function getPosValue(team: Team, pos: Position, scope: SortScope, metric: SortMetric): number {
  const t = team.totals[pos]
  if (metric === 'dynasty') {
    if (scope === 'starters') return t.dynastyStartersAvgRank
    if (scope === 'starters_plus1') return t.dynastyPlus1AvgRank
    return t.dynastyRosterAvgRank
  }
  if (metric === 'redraft') {
    if (scope === 'starters') return t.redraftStartersAvgRank
    if (scope === 'starters_plus1') return t.redraftPlus1AvgRank
    return t.redraftRosterAvgRank
  }
  if (scope === 'starters') return t.projectedStarters
  if (scope === 'starters_plus1') return t.projectedPlus1
  return t.projectedRoster
}

function getPosDisplay(team: Team, pos: Position, scope: SortScope, metric: SortMetric): string | null {
  const t = team.totals[pos]
  if (metric === 'dynasty') {
    if (scope === 'starters') return t.dynastyStartersAvgRankDisplay
    if (scope === 'starters_plus1') return t.dynastyPlus1AvgRankDisplay
    return t.dynastyRosterAvgRankDisplay
  }
  if (metric === 'redraft') {
    if (scope === 'starters') return t.redraftStartersAvgRankDisplay
    if (scope === 'starters_plus1') return t.redraftPlus1AvgRankDisplay
    return t.redraftRosterAvgRankDisplay
  }
  return null
}

function PositionMiniStats({ team, scope, metric }: { team: Team; scope: SortScope; metric: SortMetric }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {POSITIONS.map((pos) => {
        const val = getPosValue(team, pos, scope, metric)
        const display = getPosDisplay(team, pos, scope, metric)
        const shown = metric === 'projected' ? val.toFixed(0) : (display ?? val.toFixed(1))
        return (
          <div key={pos} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: POS_COLORS[pos],
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {pos}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#a0a6b8' }}>
              {shown}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const METRIC_LABELS: Record<SortMetric, string> = {
  dynasty: 'Dynasty Avg ADP',
  redraft: 'Redraft Avg ADP',
  projected: 'Proj. Points',
}

export default function LeagueOverview({ teams, onSelectTeam }: Props) {
  const [scope, setScope] = useState<SortScope>('starters')
  const [metric, setMetric] = useState<SortMetric>('dynasty')

  const ranked = useMemo(() => {
    const ascending = isAscendingMetric(metric)
    return [...teams]
      .sort((a, b) =>
        ascending
          ? getMetricValue(a, scope, metric) - getMetricValue(b, scope, metric)
          : getMetricValue(b, scope, metric) - getMetricValue(a, scope, metric)
      )
      .map((t, i) => ({ ...t, rank: i + 1 }))
  }, [teams, scope, metric])

  // For ascending metrics, the "best" bar (rank 1, lowest value) should be
  // fullest -- so we scale against the spread between best and worst.
  const ascending = isAscendingMetric(metric)
  const allValues = ranked.map((t) => getMetricValue(t, scope, metric))
  const bestVal = ascending ? Math.min(...allValues) : Math.max(...allValues)
  const worstVal = ascending ? Math.max(...allValues) : Math.min(...allValues)

  function getBarPct(val: number): number {
    if (ascending) {
      const range = worstVal - bestVal || 1
      return ((worstVal - val) / range) * 100
    }
    const range = bestVal - worstVal || 1
    return ((val - worstVal) / range) * 100
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>
          League Power Rankings
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          12-team dynasty league · 2026 season · click any team to view full roster analysis
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Scope toggle */}
        <div
          style={{
            display: 'flex',
            background: '#131a2b',
            border: '1px solid #232c47',
            borderRadius: 7,
            padding: 3,
            gap: 2,
          }}
        >
          {(['starters', 'starters_plus1', 'roster'] as SortScope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: scope === s ? 600 : 400,
                background: scope === s ? '#3b82f6' : 'transparent',
                color: scope === s ? '#fff' : '#6b7280',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {s === 'starters' ? 'Starters Only' : s === 'starters_plus1' ? 'Starters +1' : 'Full Roster'}
            </button>
          ))}
        </div>

        {/* Metric selector */}
        <div
          style={{
            display: 'flex',
            background: '#131a2b',
            border: '1px solid #232c47',
            borderRadius: 7,
            padding: 3,
            gap: 2,
          }}
        >
          {(['dynasty', 'redraft', 'projected'] as SortMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: metric === m ? 600 : 400,
                background: metric === m ? '#1c2540' : 'transparent',
                color: metric === m ? '#e2e4e9' : '#6b7280',
                border: metric === m ? '1px solid #2e3a5c' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
            Ranked by: {scope === 'starters' ? 'Starters' : scope === 'starters_plus1' ? 'Starters +1' : 'Full Roster'} · {METRIC_LABELS[metric]}
          </div>
          {scope === 'starters_plus1' && (
            <div style={{ fontSize: 11, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              +1 = best bench player added at each of QB, RB, WR, TE
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: '#131a2b',
          border: '1px solid #232c47',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '44px 1fr 140px 260px',
            padding: '10px 20px',
            borderBottom: '1px solid #232c47',
            gap: 16,
            alignItems: 'center',
          }}
        >
          {['RK', 'TEAM / OWNER', metric === 'projected' ? 'AVG PROJ' : 'AVG ADP', 'QB · RB · WR · TE'].map((h) => (
            <span
              key={h}
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: '#6b7280',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {ranked.map((team, idx) => {
          const val = getMetricValue(team, scope, metric)
          const display = getMetricDisplay(team, scope, metric)
          const barPct = getBarPct(val)

          return (
            <div
              key={team.id}
              onClick={() => onSelectTeam(team.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr 140px 260px',
                padding: '14px 20px',
                borderBottom: idx < ranked.length - 1 ? '1px solid #1b2438' : 'none',
                gap: 16,
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = '#1b2438'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              {/* Rank */}
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  fontWeight: 600,
                  color: idx < 3 ? '#3b82f6' : '#4b5563',
                  width: 28,
                  textAlign: 'right',
                }}
              >
                {team.rank}
              </div>

              {/* Team name & owner */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em', marginBottom: 2 }}>
                  {team.name}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{team.owner}</div>
              </div>

              {/* Score + bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 500, color: '#e2e4e9' }}>
                  {metric === 'projected' ? val.toFixed(1) : (display ?? val.toFixed(1))}
                </span>
                <div style={{ height: 3, background: '#232c47', borderRadius: 2, width: 110 }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${barPct}%`,
                      background: metric === 'dynasty' ? '#6366f1' : metric === 'redraft' ? '#3b82f6' : '#10b981',
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>

              {/* Per-position stats */}
              <PositionMiniStats team={team} scope={scope} metric={metric} />
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {POSITIONS.map((pos) => (
          <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: POS_COLORS[pos] }} />
            <span style={{ fontSize: 12, color: '#6b7280' }}>{pos}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>
          Click a row to view team detail →
        </div>
      </div>
    </div>
  )
}
