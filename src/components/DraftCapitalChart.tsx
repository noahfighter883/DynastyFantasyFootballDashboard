import { useState } from 'react'
import type { Team, Player, Position } from '../types'

const POS_COLORS: Record<Position, string> = {
  QB: '#818cf8',
  RB: '#34d399',
  WR: '#60a5fa',
  TE: '#fb923c',
}

const DYNASTY_LINE_COLOR = '#6366f1'
const REDRAFT_LINE_COLOR = '#3b82f6'

// Mirrors formatRoundPick() used elsewhere -- keeps axis labels consistent
// with the round.pick notation shown throughout the rest of the app.
function formatRoundPick(rank: number, teams = 12): string {
  const roundNum = Math.ceil(rank / teams)
  const pickInRound = rank - (roundNum - 1) * teams
  const pickInt = Math.max(1, Math.min(teams, Math.round(pickInRound)))
  return `${roundNum}.${pickInt}`
}

interface Props {
  team: Team
  mode: 'dynasty' | 'redraft' | 'both'
}

const WIDTH = 900
const MIN_HEIGHT = 300
const ROW_HEIGHT_PER_ROUND = 16
const PADDING_LEFT = 56
const PADDING_RIGHT = 20
const PADDING_TOP = 26
const PADDING_BOTTOM = 32
const ROUND_SIZE = 12
const MAX_ROUND = 24
const MAX_VISUAL_RANK = MAX_ROUND * ROUND_SIZE

type SeriesKey = 'dynasty' | 'redraft'

interface HoverState {
  series: SeriesKey
  playerId: string
}

export default function DraftCapitalChart({ team, mode }: Props) {
  const [hovered, setHovered] = useState<HoverState | null>(null)

  const showDynasty = mode === 'dynasty' || mode === 'both'
  const showRedraft = mode === 'redraft' || mode === 'both'

  const dynastyPlayers = showDynasty
    ? [...team.players].filter((p) => p.dynastyOverallRank != null).sort((a, b) => a.dynastyOverallRank - b.dynastyOverallRank)
    : []
  const redraftPlayers = showRedraft
    ? [...team.players].filter((p) => p.redraftOverallRank != null).sort((a, b) => a.redraftOverallRank - b.redraftOverallRank)
    : []

  if (dynastyPlayers.length === 0 && redraftPlayers.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
        No ranked players to chart.
      </div>
    )
  }

  const allRanks = [
    ...dynastyPlayers.map((p) => p.dynastyOverallRank),
    ...redraftPlayers.map((p) => p.redraftOverallRank),
  ]
  // Always start the y-axis at rank 1 (round 1.1), even if this team's best
  // player isn't actually ranked #1 -- keeps every team's chart on the same
  // baseline so they're visually comparable to each other.
  const minRank = 1

  // Size the y-axis to the roster's actual spread, up to the round-24
  // ceiling -- rather than always jumping straight to that ceiling just
  // because one or two fallback/unranked players have a very high rank.
  // Those outliers still get visually pinned to the bottom of the chart,
  // it's just a more sensible bottom instead of a fixed distant one.
  const ranksWithinCap = allRanks.filter((r) => r <= MAX_VISUAL_RANK)
  const cappedMaxRank = ranksWithinCap.length > 0 ? Math.max(...ranksWithinCap) : MAX_VISUAL_RANK
  const rankSpan = cappedMaxRank - minRank || 1

  const maxRoundNum = Math.max(1, Math.ceil(cappedMaxRank / ROUND_SIZE))
  const HEIGHT = Math.max(MIN_HEIGHT, maxRoundNum * ROW_HEIGHT_PER_ROUND + PADDING_TOP + PADDING_BOTTOM)

  const chartW = WIDTH - PADDING_LEFT - PADDING_RIGHT
  const chartH = HEIGHT - PADDING_TOP - PADDING_BOTTOM

  const maxPlayerCount = Math.max(dynastyPlayers.length, redraftPlayers.length, 1)

  const xFor = (i: number) =>
    maxPlayerCount > 1 ? PADDING_LEFT + (i / (maxPlayerCount - 1)) * chartW : PADDING_LEFT + chartW / 2

  // Lower rank (better) plots higher on the chart. Ranks beyond the roster's
  // real spread are clamped to the bottom line visually, but the real rank
  // still shows in the tooltip on hover.
  const yFor = (rank: number) => {
    const visualRank = Math.min(rank, cappedMaxRank)
    return PADDING_TOP + ((visualRank - minRank) / rankSpan) * chartH
  }

  const yTicks = Array.from({ length: maxRoundNum }, (_, i) => {
    const roundNum = i + 1
    const rank = (roundNum - 1) * ROUND_SIZE + 1
    return { rank, y: yFor(rank) }
  })

  const linePath = (players: Player[], field: 'dynastyOverallRank' | 'redraftOverallRank') =>
    players.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p[field])}`).join(' ')

  // Reference line spans the full chart, corner to corner -- from the best
  // possible pick (top-left) to the bottom of the chart at the last roster
  // slot (bottom-right). A curve that sags below this line early is
  // top-heavy; one that stays close to it has more even depth throughout.
  const referenceLinePath = `M ${xFor(0)} ${yFor(1)} L ${xFor(maxPlayerCount - 1)} ${yFor(cappedMaxRank)}`

  const hoveredPlayer =
    hovered?.series === 'dynasty'
      ? dynastyPlayers.find((p) => p.id === hovered.playerId)
      : hovered?.series === 'redraft'
      ? redraftPlayers.find((p) => p.id === hovered.playerId)
      : null
  const hoveredField = hovered?.series === 'dynasty' ? 'dynastyOverallRank' : 'redraftOverallRank'
  const hoveredIndex = hoveredPlayer
    ? (hovered?.series === 'dynasty' ? dynastyPlayers : redraftPlayers).indexOf(hoveredPlayer)
    : -1

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Y-axis gridlines + round labels */}
        {yTicks.map(({ rank, y }) => (
          <g key={rank}>
            <line x1={PADDING_LEFT} x2={WIDTH - PADDING_RIGHT} y1={y} y2={y} stroke="#1f2333" strokeWidth={1} />
            <text
              x={PADDING_LEFT - 10}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fontFamily="JetBrains Mono, monospace"
              fill="#6b7280"
            >
              {formatRoundPick(rank)}
            </text>
          </g>
        ))}

        {/* X-axis: roster rank order per series */}
        {Array.from({ length: maxPlayerCount }, (_, i) => (
          <text
            key={`x-${i}`}
            x={xFor(i)}
            y={HEIGHT - 8}
            textAnchor="middle"
            fontSize={9}
            fontFamily="JetBrains Mono, monospace"
            fill="#4b5563"
          >
            {i + 1}
          </text>
        ))}
        <text
          x={PADDING_LEFT + chartW / 2}
          y={HEIGHT - 20}
          textAnchor="middle"
          fontSize={10}
          fontFamily="JetBrains Mono, monospace"
          fill="#374151"
        >
          Roster rank (best → worst)
        </text>

        {/* Reference line -- ideal slope of -1, drawn behind the data */}
        <path d={referenceLinePath} fill="none" stroke="#374151" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />

        {/* Connecting lines -- one per active series, distinct colors */}
        {showDynasty && (
          <path d={linePath(dynastyPlayers, 'dynastyOverallRank')} fill="none" stroke={DYNASTY_LINE_COLOR} strokeWidth={1.5} opacity={0.8} />
        )}
        {showRedraft && (
          <path d={linePath(redraftPlayers, 'redraftOverallRank')} fill="none" stroke={REDRAFT_LINE_COLOR} strokeWidth={1.5} opacity={0.8} />
        )}

        {/* Redraft dots (fill = position, stroke = series color) */}
        {showRedraft && redraftPlayers.map((p, i) => {
          const isHovered = hovered?.series === 'redraft' && hovered.playerId === p.id
          return (
            <circle
              key={`redraft-${p.id}`}
              cx={xFor(i)}
              cy={yFor(p.redraftOverallRank)}
              r={isHovered ? 6 : 4}
              fill={POS_COLORS[p.position]}
              stroke={REDRAFT_LINE_COLOR}
              strokeWidth={1.5}
              style={{ cursor: 'pointer', transition: 'r 0.1s' }}
              onMouseEnter={() => setHovered({ series: 'redraft', playerId: p.id })}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}

        {/* Dynasty dots drawn on top (fill = position, stroke = series color) */}
        {showDynasty && dynastyPlayers.map((p, i) => {
          const isHovered = hovered?.series === 'dynasty' && hovered.playerId === p.id
          return (
            <circle
              key={`dynasty-${p.id}`}
              cx={xFor(i)}
              cy={yFor(p.dynastyOverallRank)}
              r={isHovered ? 6 : 4}
              fill={POS_COLORS[p.position]}
              stroke={DYNASTY_LINE_COLOR}
              strokeWidth={1.5}
              style={{ cursor: 'pointer', transition: 'r 0.1s' }}
              onMouseEnter={() => setHovered({ series: 'dynasty', playerId: p.id })}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredPlayer && hovered && (
        <div
          style={{
            position: 'absolute',
            left: `${(xFor(hoveredIndex) / WIDTH) * 100}%`,
            top: `${(yFor(hoveredPlayer[hoveredField]) / HEIGHT) * 100}%`,
            transform: 'translate(-50%, -130%)',
            background: '#1a1d27',
            border: `1px solid ${hovered.series === 'dynasty' ? DYNASTY_LINE_COLOR : REDRAFT_LINE_COLOR}`,
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            color: '#e2e4e9',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600 }}>{hoveredPlayer.name}</div>
          <div style={{ color: '#6b7280' }}>
            {hoveredPlayer.position} · {hovered.series === 'dynasty' ? 'Dynasty' : 'Redraft'} ·{' '}
            {formatRoundPick(hoveredPlayer[hoveredField])} · Rk {hoveredPlayer[hoveredField]}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 8, paddingLeft: PADDING_LEFT, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 14,
              height: 0,
              borderTop: '1px dashed #374151',
            }}
          />
          <span style={{ fontSize: 11, color: '#6b7280' }}>Ideal (even depth)</span>
        </div>
        {showDynasty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 2, background: DYNASTY_LINE_COLOR }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>Dynasty</span>
          </div>
        )}
        {showRedraft && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 2, background: REDRAFT_LINE_COLOR }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>Redraft</span>
          </div>
        )}
        <div style={{ width: 1, alignSelf: 'stretch', background: '#1f2333' }} />
        {(Object.keys(POS_COLORS) as Position[]).map((pos) => (
          <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: POS_COLORS[pos] }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>{pos}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
