import { useState } from 'react'
import type { Team } from '../types'
import { FEASIBILITY_BANDS, getFeasibilityBand } from '../data/leagueData'

interface Props {
  teams: Team[]
  onSelectTeam: (id: string) => void
}

type FilterMode = 'dynasty' | 'redraft' | 'both'

const WIDTH = 900
const HEIGHT = 420
const PADDING_LEFT = 48
const PADDING_RIGHT = 20
const PADDING_TOP = 20
const PADDING_BOTTOM = 90

function niceMax(value: number): number {
  if (value <= 0) return 10
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const step = magnitude / 2
  return Math.ceil((value * 1.15) / step) * step
}

function truncate(name: string, max = 14): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

interface HoverState {
  teamId: string
  series: 'dynasty' | 'redraft'
}

export default function FeasibilityComparison({ teams, onSelectTeam }: Props) {
  const [filter, setFilter] = useState<FilterMode>('both')
  const [hovered, setHovered] = useState<HoverState | null>(null)

  const rows = teams.map((team) => ({
    team,
    dynasty: team.totals.dynastyFeasibility,
    redraft: team.totals.redraftFeasibility,
  }))

  const sortVal = (r: (typeof rows)[number]) =>
    filter === 'dynasty' ? r.dynasty : filter === 'redraft' ? r.redraft : (r.dynasty + r.redraft) / 2

  const sorted = [...rows].sort((a, b) => sortVal(b) - sortVal(a))

  const visibleValues = sorted.flatMap((r) => (filter === 'both' ? [r.dynasty, r.redraft] : [sortVal(r)]))
  const maxVal = niceMax(Math.max(1, ...visibleValues))

  const chartW = WIDTH - PADDING_LEFT - PADDING_RIGHT
  const chartH = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const n = sorted.length
  const groupW = n > 0 ? chartW / n : chartW
  const barGap = filter === 'both' ? 3 : 0
  const barW = filter === 'both' ? (groupW - barGap - 16) / 2 : groupW - 16

  const yFor = (val: number) => PADDING_TOP + chartH - (val / maxVal) * chartH
  const barHeight = (val: number) => (val / maxVal) * chartH

  const yTicks = 5
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (maxVal / yTicks) * i)

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'Fraunces, serif',
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 28,
            letterSpacing: '-0.01em',
            marginBottom: 4,
          }}
        >
          Draft Feasibility
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          How plausible it'd be for each team's top-15 roster to have come from one real snake draft ·
          click a bar to view team detail
        </p>
      </div>

      {/* Filter toggle */}
      <div style={{ display: 'flex', marginBottom: 20 }}>
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
          {(['dynasty', 'redraft', 'both'] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              aria-pressed={filter === m}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: filter === m ? 600 : 400,
                background: filter === m ? '#1c2540' : 'transparent',
                color: filter === m ? '#e2e4e9' : '#6b7280',
                border: filter === m ? '1px solid #2e3a5c' : '1px solid transparent',
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

      {/* Band legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 20,
          padding: '12px 16px',
          background: '#131a2b',
          border: '1px solid #232c47',
          borderRadius: 8,
        }}
      >
        {FEASIBILITY_BANDS.map((band) => (
          <div key={band.label} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: band.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e4e9' }}>
                {band.label}{' '}
                <span style={{ fontWeight: 400, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
                  ({band.min}{band.max === null ? '+' : `–${band.max}`})
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{band.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div
        style={{
          background: '#131a2b',
          border: '1px solid #232c47',
          borderRadius: 10,
          padding: '18px 20px',
        }}
      >
        {filter === 'both' && (
          <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#6366f1', opacity: 0.5 }} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>Dynasty (left bar)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#3b82f6', opacity: 0.5 }} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>Redraft (right bar)</span>
            </div>
            <span style={{ fontSize: 11, color: '#4b5563' }}>Bars are colored by feasibility band above; ranked by average</span>
          </div>
        )}

        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Y gridlines */}
          {tickVals.map((v) => (
            <g key={v}>
              <line
                x1={PADDING_LEFT}
                x2={WIDTH - PADDING_RIGHT}
                y1={yFor(v)}
                y2={yFor(v)}
                stroke="#232c47"
                strokeWidth={1}
              />
              <text
                x={PADDING_LEFT - 10}
                y={yFor(v)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                fill="#6b7280"
              >
                {v.toFixed(0)}
              </text>
            </g>
          ))}

          {/* Band boundary reference lines */}
          {FEASIBILITY_BANDS.filter((b) => b.max !== null && b.max! <= maxVal).map((b) => (
            <line
              key={b.label}
              x1={PADDING_LEFT}
              x2={WIDTH - PADDING_RIGHT}
              y1={yFor(b.max!)}
              y2={yFor(b.max!)}
              stroke={b.color}
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.4}
            />
          ))}

          {/* Bars */}
          {sorted.map((row, i) => {
            const groupX = PADDING_LEFT + i * groupW + 8
            const labelX = PADDING_LEFT + i * groupW + groupW / 2

            const renderBar = (value: number, series: 'dynasty' | 'redraft', x: number) => {
              const band = getFeasibilityBand(value)
              const isHovered = hovered?.teamId === row.team.id && hovered.series === series
              return (
                <rect
                  key={series}
                  x={x}
                  y={yFor(value)}
                  width={barW}
                  height={Math.max(1, barHeight(value))}
                  fill={band.color}
                  opacity={isHovered ? 1 : 0.85}
                  rx={2}
                  style={{ cursor: 'pointer', transition: 'opacity 0.1s' }}
                  onMouseEnter={() => setHovered({ teamId: row.team.id, series })}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelectTeam(row.team.id)}
                />
              )
            }

            return (
              <g key={row.team.id}>
                {filter === 'both' ? (
                  <>
                    {renderBar(row.dynasty, 'dynasty', groupX)}
                    {renderBar(row.redraft, 'redraft', groupX + barW + barGap)}
                  </>
                ) : (
                  renderBar(sortVal(row), filter === 'redraft' ? 'redraft' : 'dynasty', groupX)
                )}

                {/* X label */}
                <text
                  x={labelX}
                  y={HEIGHT - PADDING_BOTTOM + 16}
                  textAnchor="end"
                  fontSize={10}
                  fontFamily="JetBrains Mono, monospace"
                  fill="#a0a6b8"
                  transform={`rotate(-40 ${labelX} ${HEIGHT - PADDING_BOTTOM + 16})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectTeam(row.team.id)}
                >
                  {truncate(row.team.name)}
                </text>
              </g>
            )
          })}

          <text
            x={PADDING_LEFT + chartW / 2}
            y={HEIGHT - 10}
            textAnchor="middle"
            fontSize={10}
            fontFamily="JetBrains Mono, monospace"
            fill="#374151"
          >
            Team (highest → lowest feasibility)
          </text>
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#a0a6b8', minHeight: 18 }}>
            {(() => {
              const row = sorted.find((r) => r.team.id === hovered.teamId)
              if (!row) return null
              const value = hovered.series === 'dynasty' ? row.dynasty : row.redraft
              const band = getFeasibilityBand(value)
              return (
                <span>
                  <span style={{ color: '#e2e4e9', fontWeight: 600 }}>{row.team.name}</span> ·{' '}
                  {hovered.series === 'dynasty' ? 'Dynasty' : 'Redraft'}:{' '}
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value.toFixed(1)}</span> ·{' '}
                  <span style={{ color: band.color }}>{band.label}</span>
                </span>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
