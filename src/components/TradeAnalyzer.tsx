import { useMemo, useState } from 'react'
import type { Team, FuturePick } from '../types'

interface Props {
  teams: Team[]
}

interface KeyedPick extends FuturePick {
  key: string
}

function keyedFuturePicks(team: Team): KeyedPick[] {
  return team.futurePicks
    .map((p, i) => ({ ...p, key: `${team.id}:${i}` }))
    .sort((a, b) => Number(a.season) - Number(b.season) || a.round - b.round)
}

function groupBySeason(picks: KeyedPick[]): [string, KeyedPick[]][] {
  const map = new Map<string, KeyedPick[]>()
  for (const p of picks) {
    const existing = map.get(p.season)
    if (existing) existing.push(p)
    else map.set(p.season, [p])
  }
  return [...map.entries()]
}

interface FairnessBand {
  label: (favored: string) => string
  color: string
}

// Verdict thresholds are based on the value differential as a percentage of
// the larger side's total -- not a precise statistical cutoff, just a
// reasonable starting point for "this looks fair" vs. "one side is winning
// big." Tune freely.
function getFairnessBand(diffPct: number): FairnessBand {
  if (diffPct <= 10) return { label: () => 'Fair Trade', color: '#34d399' }
  if (diffPct <= 25) return { label: (favored) => `Slight Edge to ${favored}`, color: '#60a5fa' }
  if (diffPct <= 50) return { label: (favored) => `${favored} Wins This Trade`, color: '#f0b429' }
  return { label: (favored) => `Lopsided -- ${favored} Wins Big`, color: '#f87171' }
}

function formatValue(v: number): string {
  return v.toLocaleString()
}

interface PanelProps {
  side: 'A' | 'B'
  teams: Team[]
  teamId: string
  otherTeamId: string
  onTeamChange: (id: string) => void
  selected: Set<string>
  onToggle: (key: string, value: number) => void
}

function TradePanel({ side, teams, teamId, otherTeamId, onTeamChange, selected, onToggle }: PanelProps) {
  const team = teams.find((t) => t.id === teamId)
  const sortedPlayers = useMemo(
    () => (team ? [...team.players].sort((a, b) => b.dynastyTradeValue - a.dynastyTradeValue) : []),
    [team]
  )
  const pickGroups = useMemo(() => (team ? groupBySeason(keyedFuturePicks(team)) : []), [team])

  if (!team) return null

  return (
    <div
      style={{
        background: '#131a2b',
        border: '1px solid #232c47',
        borderRadius: 10,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minWidth: 0,
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, letterSpacing: '0.05em' }}>
          TEAM {side} SENDS
        </div>
        <select
          value={teamId}
          onChange={(e) => onTeamChange(e.target.value)}
          style={{
            width: '100%',
            background: '#0a0f1e',
            border: '1px solid #232c47',
            borderRadius: 6,
            color: '#e2e4e9',
            fontSize: 14,
            fontWeight: 600,
            padding: '8px 10px',
          }}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === otherTeamId}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.07em', marginBottom: 6 }}>PLAYERS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 320, overflowY: 'auto' }}>
          {sortedPlayers.map((p) => {
            const key = `player:${p.id}`
            const checked = selected.has(key)
            return (
              <label
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: checked ? '#1c2540' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(key, p.dynastyTradeValue)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ flex: 1, fontSize: 13, color: '#e2e4e9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>{p.position}</span>
                <span style={{ fontSize: 12, color: '#a0a6b8', fontFamily: 'JetBrains Mono, monospace', minWidth: 46, textAlign: 'right' }}>
                  {formatValue(p.dynastyTradeValue)}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {pickGroups.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.07em', marginBottom: 6 }}>FUTURE PICKS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pickGroups.map(([season, picks]) => (
              <div key={season}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 3, fontFamily: 'JetBrains Mono, monospace' }}>
                  {season}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {picks.map((p) => {
                    const checked = selected.has(p.key)
                    return (
                      <label
                        key={p.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: checked ? '#1c2540' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggle(p.key, p.tradeValue)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ flex: 1, fontSize: 13, color: '#e2e4e9' }}>
                          Round {p.round}
                          {p.originalTeamName && (
                            <span style={{ color: '#6b7280' }}> (from {p.originalTeamName})</span>
                          )}
                        </span>
                        <span style={{ fontSize: 12, color: '#a0a6b8', fontFamily: 'JetBrains Mono, monospace', minWidth: 46, textAlign: 'right' }}>
                          {formatValue(p.tradeValue)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TradeAnalyzer({ teams }: Props) {
  const [teamAId, setTeamAId] = useState(teams[0]?.id ?? '')
  const [teamBId, setTeamBId] = useState(teams[1]?.id ?? teams[0]?.id ?? '')
  const [sentByA, setSentByA] = useState<Map<string, number>>(new Map())
  const [sentByB, setSentByB] = useState<Map<string, number>>(new Map())

  const toggle = (map: Map<string, number>, setMap: (m: Map<string, number>) => void, key: string, value: number) => {
    const next = new Map(map)
    if (next.has(key)) next.delete(key)
    else next.set(key, value)
    setMap(next)
  }

  const changeTeam = (
    id: string,
    setId: (id: string) => void,
    setMap: (m: Map<string, number>) => void
  ) => {
    setId(id)
    setMap(new Map())
  }

  const totalA = [...sentByA.values()].reduce((a, b) => a + b, 0)
  const totalB = [...sentByB.values()].reduce((a, b) => a + b, 0)
  const total = totalA + totalB
  const diffPct = total === 0 ? 0 : (Math.abs(totalA - totalB) / Math.max(totalA, totalB, 1)) * 100
  const band = getFairnessBand(diffPct)
  const teamAName = teams.find((t) => t.id === teamAId)?.name ?? 'Team A'
  const teamBName = teams.find((t) => t.id === teamBId)?.name ?? 'Team B'
  const favored = totalA === totalB ? '' : totalA > totalB ? teamAName : teamBName
  const hasSelections = sentByA.size > 0 || sentByB.size > 0

  if (teams.length < 2) {
    return (
      <div style={{ color: '#6b7280', fontSize: 14 }}>
        Need at least two teams in the league to analyze a trade.
      </div>
    )
  }

  return (
    <div>
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
          Trade Analyzer
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          Pick two teams, check off what each side sends, and see who wins the trade -- using
          real dynasty trade value for both players and future draft picks.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <TradePanel
          side="A"
          teams={teams}
          teamId={teamAId}
          otherTeamId={teamBId}
          onTeamChange={(id) => changeTeam(id, setTeamAId, setSentByA)}
          selected={new Set(sentByA.keys())}
          onToggle={(key, value) => toggle(sentByA, setSentByA, key, value)}
        />
        <TradePanel
          side="B"
          teams={teams}
          teamId={teamBId}
          otherTeamId={teamAId}
          onTeamChange={(id) => changeTeam(id, setTeamBId, setSentByB)}
          selected={new Set(sentByB.keys())}
          onToggle={(key, value) => toggle(sentByB, setSentByB, key, value)}
        />
      </div>

      <div
        style={{
          background: '#131a2b',
          border: `1px solid ${hasSelections ? band.color : '#232c47'}`,
          borderRadius: 10,
          padding: '18px 20px',
        }}
      >
        <div style={{ display: 'flex', gap: 32, marginBottom: hasSelections ? 14 : 0, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{teamAName} sends</div>
            <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
              {formatValue(totalA)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{teamBName} sends</div>
            <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
              {formatValue(totalB)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Differential</div>
            <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
              {formatValue(Math.abs(totalA - totalB))}
            </div>
          </div>
        </div>

        {hasSelections && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 6,
              background: '#0a0f1e',
              border: `1px solid ${band.color}`,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: band.color }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: band.color }}>
              {band.label(favored)}
            </span>
          </div>
        )}

        {!hasSelections && (
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
            Check off players and/or picks on each side to build the trade.
          </p>
        )}
      </div>
    </div>
  )
}
