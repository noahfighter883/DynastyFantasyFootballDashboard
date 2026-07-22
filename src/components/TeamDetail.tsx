import { useState, useMemo } from 'react'
import type { Team, Player, Position, SortMetric } from '../types'
import DraftCapitalChart from './DraftCapitalChart'

interface Props {
  team: Team
  cameFrom?: 'overview' | 'position'
  initialPosFilter?: Position | 'ALL'
}

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE']
const POS_COLORS: Record<Position, string> = {
  QB: '#818cf8',
  RB: '#34d399',
  WR: '#60a5fa',
  TE: '#fb923c',
}

type SortCol = 'name' | 'position' | 'isStarter' | 'dynastyValue' | 'redraftValue' | 'projectedPoints'

function metricSort(
  arr: Player[],
  field: 'dynastyOverallRank' | 'redraftOverallRank' | 'projectedPoints',
  higherIsBetter: boolean
): Player[] {
  return [...arr].sort((a, b) => (higherIsBetter ? b[field] - a[field] : a[field] - b[field]))
}

function dynamicStartersAndPlus1(
  allAtPos: Player[],
  numSlots: number,
  field: 'dynastyOverallRank' | 'redraftOverallRank' | 'projectedPoints',
  higherIsBetter: boolean
): { starters: Player[]; plus1: Player | null } {
  const sorted = metricSort(allAtPos, field, higherIsBetter)
  const starters = sorted.slice(0, numSlots)
  const plus1 = sorted.length > numSlots ? sorted[numSlots] : null
  return { starters, plus1 }
}

function metricField(metric: SortMetric): 'dynastyOverallRank' | 'redraftOverallRank' | 'projectedPoints' {
  if (metric === 'dynasty') return 'dynastyOverallRank'
  if (metric === 'redraft') return 'redraftOverallRank'
  return 'projectedPoints'
}

function PositionCard({
  team,
  pos,
  metric,
  isActive,
  onClick,
}: {
  team: Team
  pos: Position
  metric: SortMetric
  isActive: boolean
  onClick: () => void
}) {
  const t = team.totals[pos]
  const players = team.players.filter((p) => p.position === pos)
  const starters = players.filter((p) => p.isStarter)
  const color = POS_COLORS[pos]
  const cardStyle: React.CSSProperties = {
    background: isActive ? color + '0d' : '#131a2b',
    border: '1px solid #232c47',
    borderTop: `2px solid ${color}`,
    borderRadius: 8,
    padding: '16px 18px',
    flex: '1 1 200px',
    minWidth: 200,
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: isActive ? `inset 0 0 0 1px ${color}` : 'none',
    transition: 'box-shadow 0.15s, background 0.15s',
  }

  let headline: string
  let headlineSub: string
  let barPct: number
  let footerLabel: string
  let footerVal: string

  const isAscending = metric === 'dynasty' || metric === 'redraft'
  const higherIsBetter = !isAscending
  const field = metricField(metric)

  let startersVal: number | null
  let rosterVal: number | null
  let plus1Val: number | null
  let startersDisplay: string | null = null
  let rosterDisplay: string | null = null
  let plus1Display: string | null = null

  if (metric === 'dynasty') {
    startersVal = t.dynastyStartersAvgRank
    rosterVal = t.dynastyRosterAvgRank
    plus1Val = t.dynastyPlus1AvgRank
    startersDisplay = t.dynastyStartersAvgRankDisplay
    rosterDisplay = t.dynastyRosterAvgRankDisplay
    plus1Display = t.dynastyPlus1AvgRankDisplay
  } else if (metric === 'redraft') {
    startersVal = t.redraftStartersAvgRank
    rosterVal = t.redraftRosterAvgRank
    plus1Val = t.redraftPlus1AvgRank
    startersDisplay = t.redraftStartersAvgRankDisplay
    rosterDisplay = t.redraftRosterAvgRankDisplay
    plus1Display = t.redraftPlus1AvgRankDisplay
  } else {
    startersVal = t.projectedStarters
    rosterVal = t.projectedRoster
    plus1Val = t.projectedPlus1
  }

  const realSlotsAtPos = starters.length
  const { plus1: plus1Player } = dynamicStartersAndPlus1(players, realSlotsAtPos, field, higherIsBetter)

  const fmt = (v: number | null, d: string | null) => d ?? v?.toFixed(1) ?? '—'

  headline = fmt(startersVal, startersDisplay)
  headlineSub = metric === 'projected' ? 'avg starter pts' : 'avg starter rank'
  footerLabel = metric === 'projected' ? 'Full roster avg pts' : 'Full roster avg rank'
  footerVal = fmt(rosterVal, rosterDisplay)

  if (startersVal != null && rosterVal != null && rosterVal !== 0) {
    const advantage = isAscending ? rosterVal - startersVal : startersVal - rosterVal
    barPct = Math.max(0, Math.min(100, (advantage / Math.abs(rosterVal)) * 100))
  } else {
    barPct = 0
  }

  return (
    <button type="button" style={cardStyle} onClick={onClick} aria-pressed={isActive}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color, fontFamily: 'JetBrains Mono, monospace' }}>
            {pos}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {players.length} rostered · {starters.length} starting
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#e2e4e9' }}>
            {headline}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{headlineSub}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ height: 6, background: '#232c47', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${barPct}%`, background: color, borderRadius: 3 }} />
          <div style={{ flex: 1, background: color + '33' }} />
        </div>
      </div>

      {plus1Player && (
        <div
          style={{
            fontSize: 11,
            color: '#6b7280',
            background: '#0a0f1e',
            borderRadius: 5,
            padding: '6px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <span>+1: {plus1Player.name}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#a0a6b8' }}>
            {fmt(plus1Val, plus1Display)}
          </span>
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: '#6b7280',
          background: '#0a0f1e',
          borderRadius: 5,
          padding: '6px 10px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{footerLabel}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#a0a6b8' }}>{footerVal}</span>
      </div>
    </button>
  )
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: 'asc' | 'desc' }) {
  if (col !== sortCol) return <span style={{ color: '#2e3a5c', fontSize: 10, marginLeft: 4 }}>⇅</span>
  return <span style={{ color: '#3b82f6', fontSize: 10, marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
}

export default function TeamDetail({ team, cameFrom = 'overview', initialPosFilter = 'ALL' }: Props) {
  const [metric, setMetric] = useState<SortMetric>('dynasty')
  const [sortCol, setSortCol] = useState<SortCol>('isStarter')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>(initialPosFilter)
  const [chartMode, setChartMode] = useState<'dynasty' | 'redraft' | 'both'>('both')

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('desc') }
  }

  const sorted = useMemo(() => {
    const base = posFilter === 'ALL' ? team.players : team.players.filter((p) => p.position === posFilter)
    return [...base].sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      switch (sortCol) {
        case 'name':           av = a.name; bv = b.name; break
        case 'position':       av = a.position; bv = b.position; break
        case 'isStarter':      av = a.isStarter ? 1 : 0; bv = b.isStarter ? 1 : 0; break
        case 'dynastyValue':   av = a.dynastyValue; bv = b.dynastyValue; break
        case 'redraftValue':   av = a.redraftValue; bv = b.redraftValue; break
        case 'projectedPoints':av = a.projectedPoints; bv = b.projectedPoints; break
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [team.players, sortCol, sortDir, posFilter])

  const plus1Ids = useMemo(() => {
    const field = metricField(metric)
    const higherIsBetter = metric === 'projected'
    const ids = new Set<string>()
    for (const pos of POSITIONS) {
      const allAtPos = team.players.filter((p) => p.position === pos)
      const realSlots = allAtPos.filter((p) => p.isStarter).length
      const { plus1 } = dynamicStartersAndPlus1(allAtPos, realSlots, field, higherIsBetter)
      if (plus1) ids.add(plus1.id)
    }
    return ids
  }, [team.players, metric])

  const headerStyle = (col: SortCol): React.CSSProperties => ({
    cursor: 'pointer',
    userSelect: 'none',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.07em',
    color: sortCol === col ? '#a0a6b8' : '#6b7280',
    fontFamily: 'JetBrains Mono, monospace',
    padding: '10px 8px',
    whiteSpace: 'nowrap',
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
  })

  return (
    <div>
      {/* Team header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <h1
            style={{
              fontFamily: 'Fraunces, serif',
              fontStyle: 'italic',
              fontWeight: 600,
              fontSize: 32,
              letterSpacing: '-0.01em',
            }}
          >
            {team.name}
          </h1>
          <span style={{ fontSize: 15, color: '#6b7280' }}>{team.owner}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 13, color: '#4b5563', fontFamily: 'JetBrains Mono, monospace' }}>
            {team.players.length} players rostered · {team.players.filter((p) => p.isStarter).length} starters
          </span>
          {posFilter !== 'ALL' && (
            <button
              onClick={() => setPosFilter('ALL')}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 5,
                background: '#1c2540',
                color: '#e2e4e9',
                border: '1px solid #2e3a5c',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              ALL · clear {posFilter} filter ×
            </button>
          )}
        </div>
      </div>

      {cameFrom === 'position' && (
        <>
          {/* Metric toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Position cards:</span>
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
                  aria-pressed={metric === m}
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
                    textTransform: 'capitalize',
                  }}
                >
                  {m === 'projected' ? 'Proj. Pts' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Position cards -- click to filter the roster table below */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
            {POSITIONS.map((pos) => (
              <PositionCard
                key={pos}
                team={team}
                pos={pos}
                metric={metric}
                isActive={posFilter === pos}
                onClick={() => setPosFilter(posFilter === pos ? 'ALL' : pos)}
              />
            ))}
          </div>
        </>
      )}

      {/* Draft capital curve -- only shown when arriving from League Overview */}
      {cameFrom === 'overview' && (
        <div
          style={{
            background: '#131a2b',
            border: '1px solid #232c47',
            borderRadius: 10,
            padding: '18px 20px',
            marginBottom: 28,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>Draft Capital Curve</h2>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Full roster, sorted best to worst by rank
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                background: '#0a0f1e',
                border: '1px solid #232c47',
                borderRadius: 7,
                padding: 3,
                gap: 2,
              }}
            >
              {(['dynasty', 'redraft', 'both'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  aria-pressed={chartMode === m}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 5,
                    fontSize: 12,
                    fontWeight: chartMode === m ? 600 : 400,
                    background: chartMode === m ? '#1c2540' : 'transparent',
                    color: chartMode === m ? '#e2e4e9' : '#6b7280',
                    border: chartMode === m ? '1px solid #2e3a5c' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <DraftCapitalChart team={team} mode={chartMode} />
        </div>
      )}

      {/* Player table section header */}
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Full Roster {posFilter !== 'ALL' && <span style={{ color: '#6b7280', fontWeight: 400 }}>· {posFilter} only</span>}
        </h2>
      </div>

      {/* Player table */}
      <div
        className="table-scroll"
        style={{
          background: '#131a2b',
          border: '1px solid #232c47',
          borderRadius: 10,
        }}
      >
        <div style={{ minWidth: 720 }}>
          {/* Header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 80px 72px 100px 100px 100px 90px',
              padding: '0 16px',
              borderBottom: '1px solid #232c47',
              background: '#0a0f1e',
              alignItems: 'center',
            }}
          >
            <span style={{ ...headerStyle('isStarter'), padding: '10px 4px', cursor: 'default' }}>#</span>
            <button onClick={() => handleSort('name')} style={headerStyle('name')}>
              PLAYER <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
            </button>
            <button onClick={() => handleSort('position')} style={headerStyle('position')}>
              POS <SortIcon col="position" sortCol={sortCol} sortDir={sortDir} />
            </button>
            <button onClick={() => handleSort('isStarter')} style={headerStyle('isStarter')}>
              ROLE <SortIcon col="isStarter" sortCol={sortCol} sortDir={sortDir} />
            </button>
            <button onClick={() => handleSort('dynastyValue')} style={headerStyle('dynastyValue')}>
              DYN RK <SortIcon col="dynastyValue" sortCol={sortCol} sortDir={sortDir} />
            </button>
            <button onClick={() => handleSort('redraftValue')} style={headerStyle('redraftValue')}>
              RDR RK <SortIcon col="redraftValue" sortCol={sortCol} sortDir={sortDir} />
            </button>
            <button onClick={() => handleSort('projectedPoints')} style={headerStyle('projectedPoints')}>
              PROJ PTS <SortIcon col="projectedPoints" sortCol={sortCol} sortDir={sortDir} />
            </button>
            <span style={{ ...headerStyle('name'), cursor: 'default' }}>ACQ</span>
          </div>

          {/* Player rows */}
          {sorted.map((player, idx) => (
            <PlayerRow key={player.id} player={player} idx={idx} isLast={idx === sorted.length - 1} isPlus1={plus1Ids.has(player.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PlayerRow({ player, idx, isLast, isPlus1 }: { player: Player; idx: number; isLast: boolean; isPlus1: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr 80px 72px 100px 100px 100px 90px',
        padding: '11px 16px',
        borderBottom: isLast ? 'none' : '1px solid #1b2438',
        alignItems: 'center',
        background: hovered ? '#1b2438' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Index */}
      <span style={{ fontSize: 11, color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>{idx + 1}</span>

      {/* Name + NFL team */}
      <div>
        <div style={{ fontWeight: 500, fontSize: 13, letterSpacing: '-0.01em' }}>{player.name}</div>
        <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>{player.nflTeam}</div>
      </div>

      {/* Position badge */}
      <div>
        <span
          className={`pos-badge-${player.position}`}
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '2px 7px',
            borderRadius: 4,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {player.position}
        </span>
      </div>

      {/* Starter/bench */}
      <div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: player.isStarter ? '#34d399' : isPlus1 ? '#f0b429' : '#4b5563',
            background: player.isStarter ? 'rgba(52,211,153,0.08)' : isPlus1 ? 'rgba(240,180,41,0.1)' : 'rgba(75,85,99,0.1)',
            padding: '2px 7px',
            borderRadius: 4,
            fontFamily: 'JetBrains Mono, monospace',
          }}
          title={isPlus1 ? "Currently the best bench player at this position -- counts in the 'Starters +1' scope" : undefined}
        >
          {player.isStarter ? 'STR' : isPlus1 ? 'BN +1' : 'BN'}
        </span>
      </div>

      {/* Dynasty rank */}
      <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace', color: '#e2e4e9' }}>
        {player.dynastyOverallRank}
        {player.dynastyPositionRank != null && (
          <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 400 }}>
            {player.position}{player.dynastyPositionRank}
          </div>
        )}
      </div>

      {/* Redraft rank */}
      <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace', color: '#e2e4e9' }}>
        {player.redraftOverallRank}
        {player.redraftPositionRank != null && (
          <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 400 }}>
            {player.position}{player.redraftPositionRank}
          </div>
        )}
      </div>

      {/* Projected points */}
      <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'JetBrains Mono, monospace', color: '#a0a6b8' }}>
        {player.projectedPoints.toFixed(1)}
        {player.projectedPositionRank != null && (
          <div style={{ fontSize: 10, color: '#4b5563', fontWeight: 400 }}>
            {player.position}{player.projectedPositionRank}
          </div>
        )}
      </div>

      {/* Acquisition type */}
      <div>
        {player.acquisitionType && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.03em',
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: 'JetBrains Mono, monospace',
              ...acquisitionStyle(player.acquisitionType),
            }}
          >
            {player.acquisitionType}
          </span>
        )}
      </div>
    </div>
  )
}

function acquisitionStyle(type: 'Drafted' | 'Trade' | 'Waiver' | 'Other'): { color: string; background: string } {
  if (type === 'Drafted') return { color: '#818cf8', background: 'rgba(129,140,248,0.1)' }
  if (type === 'Trade') return { color: '#fb923c', background: 'rgba(251,146,60,0.1)' }
  if (type === 'Waiver') return { color: '#34d399', background: 'rgba(52,211,153,0.08)' }
  return { color: '#6b7280', background: 'rgba(107,114,128,0.1)' }
}
