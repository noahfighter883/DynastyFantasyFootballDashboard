import { useState, useMemo } from 'react'
import type { Team, Position, SortScope, SortMetric } from '../types'

interface Props {
  teams: Team[]
  onSelectTeam: (id: string, pos?: Position) => void
}

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE']
const POS_COLORS: Record<Position, string> = {
  QB: '#818cf8',
  RB: '#34d399',
  WR: '#60a5fa',
  TE: '#fb923c',
}
const POS_LABELS: Record<Position, string> = {
  QB: 'Quarterbacks',
  RB: 'Running Backs',
  WR: 'Wide Receivers',
  TE: 'Tight Ends',
}

// Dynasty/redraft are now "lower is better" (average draft-round rank).
function isAscendingMetric(metric: SortMetric): boolean {
  return metric === 'dynasty' || metric === 'redraft'
}

function getVal(team: Team, pos: Position, scope: SortScope, metric: SortMetric): number {
  const t = team.totals[pos]
  if (metric === 'dynasty') {
    if (scope === 'starters') return t.dynastyStartersAvgRank ?? 0
    if (scope === 'starters_plus1') return t.dynastyPlus1AvgRank ?? 0
    return t.dynastyRosterAvgRank ?? 0
  }
  if (metric === 'redraft') {
    if (scope === 'starters') return t.redraftStartersAvgRank ?? 0
    if (scope === 'starters_plus1') return t.redraftPlus1AvgRank ?? 0
    return t.redraftRosterAvgRank ?? 0
  }
  if (scope === 'starters') return t.projectedStarters ?? 0
  if (scope === 'starters_plus1') return t.projectedPlus1 ?? 0
  return t.projectedRoster ?? 0
}

function getDisplay(team: Team, pos: Position, scope: SortScope, metric: SortMetric): string | null {
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

function scopeLabel(scope: SortScope): string {
  if (scope === 'starters') return 'Starters Only'
  if (scope === 'starters_plus1') return 'Starters +1'
  return 'Full Roster'
}

export default function PositionComparison({ teams, onSelectTeam }: Props) {
  const [pos, setPos] = useState<Position>('WR')
  const [scope, setScope] = useState<SortScope>('starters')
  const [metric, setMetric] = useState<SortMetric>('dynasty')
  const ascending = isAscendingMetric(metric)

  const ranked = useMemo(() => {
    const withVals = [...teams].map((t) => ({
      ...t,
      starterVal: getVal(t, pos, 'starters', metric),
      rosterVal: getVal(t, pos, 'roster', metric),
      plus1Val: getVal(t, pos, 'starters_plus1', metric),
      starterDisplay: getDisplay(t, pos, 'starters', metric),
      rosterDisplay: getDisplay(t, pos, 'roster', metric),
      plus1Display: getDisplay(t, pos, 'starters_plus1', metric),
      playerCount: t.players.filter((p) => p.position === pos).length,
      starterCount: t.players.filter((p) => p.position === pos && p.isStarter).length,
    }))

    const valFor = (t: (typeof withVals)[number]) =>
      scope === 'starters' ? t.starterVal : scope === 'starters_plus1' ? t.plus1Val : t.rosterVal

    return withVals.sort((a, b) => {
      const av = valFor(a)
      const bv = valFor(b)
      return ascending ? av - bv : bv - av
    })
  }, [teams, pos, scope, metric, ascending])

  // Scale bars against the best/worst spread so the top-ranked team always
  // shows the fullest bar, regardless of sort direction.
  const primaryValOf = (t: (typeof ranked)[number]) =>
    scope === 'starters' ? t.starterVal : scope === 'starters_plus1' ? t.plus1Val : t.rosterVal
  const primaryVals = ranked.map(primaryValOf)
  const bestVal = ascending ? Math.min(...primaryVals) : Math.max(...primaryVals)
  const worstVal = ascending ? Math.max(...primaryVals) : Math.min(...primaryVals)

  function getBarPct(val: number): number {
    if (ascending) {
      const range = worstVal - bestVal || 1
      return ((worstVal - val) / range) * 100
    }
    const range = bestVal - worstVal || 1
    return ((val - worstVal) / range) * 100
  }

  const posColor = POS_COLORS[pos]
  const metricFmt = (v: number, display: string | null) => (metric === 'projected' ? v.toFixed(1) : (display ?? v.toFixed(1)))
  const metricSuffix = metric === 'projected' ? ' pts' : ''

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>
          Position Comparison
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          Compare all 12 teams at a single position — ranked by starters or full roster
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Position selector */}
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
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              style={{
                padding: '6px 18px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: pos === p ? 700 : 400,
                background: pos === p ? POS_COLORS[p] + '22' : 'transparent',
                color: pos === p ? POS_COLORS[p] : '#6b7280',
                border: pos === p ? `1px solid ${POS_COLORS[p]}44` : '1px solid transparent',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.04em',
                transition: 'all 0.15s',
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Scope */}
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
              }}
            >
              {scopeLabel(s)}
            </button>
          ))}
        </div>

        {/* Metric */}
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
              {m === 'projected' ? 'Proj. Pts' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Section label */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 3,
            height: 20,
            background: posColor,
            borderRadius: 2,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 15, color: posColor }}>{POS_LABELS[pos]}</span>
        <span style={{ color: '#6b7280', fontSize: 13 }}>
          · {scopeLabel(scope)} ·{' '}
          {metric === 'dynasty' ? 'Dynasty Value' : metric === 'redraft' ? 'Redraft Value' : 'Projected Points'}
        </span>
      </div>

      {/* Ranked bars */}
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
            gridTemplateColumns: '36px 1fr 90px 200px 120px',
            padding: '10px 20px',
            borderBottom: '1px solid #232c47',
            gap: 12,
            alignItems: 'center',
            background: '#0a0f1e',
          }}
        >
          {['RK', 'TEAM', 'PLAYERS', 'VALUE BAR', scope === 'starters' ? 'STARTERS' : scope === 'starters_plus1' ? 'STARTERS +1' : 'ROSTER'].map((h) => (
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

        {ranked.map((team, idx) => {
          const primaryVal = primaryValOf(team)
          const primaryDisplay =
            scope === 'starters' ? team.starterDisplay : scope === 'starters_plus1' ? team.plus1Display : team.rosterDisplay
          const primaryPct = getBarPct(primaryVal)

          return (
            <div
              key={team.id}
              onClick={() => onSelectTeam(team.id, pos)}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 90px 200px 120px',
                padding: '14px 20px',
                borderBottom: idx < ranked.length - 1 ? '1px solid #1b2438' : 'none',
                gap: 12,
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
                  color: idx < 3 ? posColor : '#4b5563',
                }}
              >
                {idx + 1}
              </div>

              {/* Team */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-0.01em' }}>{team.name}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{team.owner}</div>
              </div>

              {/* Player count */}
              <div style={{ fontSize: 12, color: '#a0a6b8', fontFamily: 'JetBrains Mono, monospace' }}>
                <span style={{ color: '#e2e4e9' }}>{team.starterCount}</span>
                <span style={{ color: '#4b5563' }}> str</span>
                {' · '}
                <span style={{ color: '#a0a6b8' }}>{team.playerCount}</span>
                <span style={{ color: '#4b5563' }}> tot</span>
              </div>

              {/* Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ height: 8, background: '#232c47', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${primaryPct}%`,
                      background: posColor,
                      opacity: 0.85,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>

              {/* Value for the currently selected scope only */}
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 500, color: '#e2e4e9' }}>
                {metricFmt(primaryVal, primaryDisplay)}{metricSuffix}
              </div>
            </div>
          )
        })}
      </div>

      {/* All four positions summary grid */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, letterSpacing: '-0.02em' }}>
          All Positions Snapshot — {scopeLabel(scope)} ·{' '}
          {metric === 'dynasty' ? 'Dynasty' : metric === 'redraft' ? 'Redraft' : 'Proj. Pts'}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {POSITIONS.map((p) => {
            const posRanked = [...teams]
              .map((t) => ({ ...t, val: getVal(t, p, scope, metric) }))
              .sort((a, b) => (ascending ? a.val - b.val : b.val - a.val))

            const posVals = posRanked.map((t) => t.val)
            const posBest = ascending ? Math.min(...posVals) : Math.max(...posVals)
            const posWorst = ascending ? Math.max(...posVals) : Math.min(...posVals)
            const posBarPct = (val: number) => {
              if (ascending) {
                const range = posWorst - posBest || 1
                return ((posWorst - val) / range) * 100
              }
              const range = posBest - posWorst || 1
              return ((val - posWorst) / range) * 100
            }

            return (
              <div
                key={p}
                style={{
                  background: '#131a2b',
                  border: `1px solid #232c47`,
                  borderTop: `2px solid ${POS_COLORS[p]}`,
                  borderRadius: 8,
                  padding: '14px 16px',
                  cursor: p !== pos ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (p !== pos) setPos(p)
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: POS_COLORS[p],
                    fontFamily: 'JetBrains Mono, monospace',
                    marginBottom: 10,
                  }}
                >
                  {p} {p === pos && <span style={{ color: '#4b5563', fontWeight: 400 }}>← active</span>}
                </div>
                {posRanked.slice(0, 4).map((t, i) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace', width: 14 }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, height: 4, background: '#232c47', borderRadius: 2 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${posBarPct(t.val)}%`,
                          background: POS_COLORS[p],
                          opacity: 0.7,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 10, color: '#a0a6b8', minWidth: 32, textAlign: 'right' }}>
                      {t.name.split(' ').slice(-1)[0]}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>+ {posRanked.length - 4} more</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
