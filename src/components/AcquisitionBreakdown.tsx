import { useEffect, useMemo, useState } from 'react'
import type { Team, Player, Position, SortScope } from '../types'
import type { AcquisitionMap, AcquisitionType } from '../data/acquisitionsData'
import { ACQUISITION_TYPES, acquisitionStyle } from '../data/acquisitionsData'

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE']

// "Starters +1" adds the single best bench player per position (by dynasty
// rank -- the app's default value lens) on top of the real starters, same
// concept as the +1 scope elsewhere in the app (see TeamDetail.tsx's
// dynamicStartersAndPlus1), just without exposing a separate metric toggle
// here since this table isn't ranking anything.
function selectScopedPlayers(players: Player[], scope: SortScope): Player[] {
  if (scope === 'roster') return players
  const starters = players.filter((p) => p.isStarter)
  if (scope === 'starters') return starters
  const plus1: Player[] = []
  for (const pos of POSITIONS) {
    const bench = players
      .filter((p) => p.position === pos && !p.isStarter)
      .sort((a, b) => a.dynastyOverallRank - b.dynastyOverallRank)
    if (bench.length > 0) plus1.push(bench[0])
  }
  return [...starters, ...plus1]
}

interface Props {
  teams: Team[]
  // null in Demo League -- demo rosters use synthetic player IDs that can't
  // be matched against a real league's acquisition records, the same reason
  // Team Detail's ACQUIRED column stays blank there. See PageHeader's demo
  // empty state below rather than attempting a fetch that can't work.
  leagueId: string | null
}

type BreakdownState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; acquisitions: AcquisitionMap }

const UNATTRIBUTED = 'Unattributed' as const
type CountKey = AcquisitionType | typeof UNATTRIBUTED
const COUNT_KEYS: CountKey[] = [...ACQUISITION_TYPES, UNATTRIBUTED]

interface TeamAcquisitionCounts {
  teamId: string
  teamName: string
  ownerName: string
  counts: Record<CountKey, number>
  total: number
}

function unattributedStyle(): { color: string; background: string } {
  return { color: '#6b7280', background: 'rgba(107,114,128,0.1)' }
}

function styleFor(key: CountKey): { color: string; background: string } {
  return key === UNATTRIBUTED ? unattributedStyle() : acquisitionStyle(key)
}

function computeTeamCounts(teams: Team[], acquisitions: AcquisitionMap, scope: SortScope): TeamAcquisitionCounts[] {
  return teams.map((team) => {
    const counts = { 'Startup Draft': 0, 'Rookie Draft': 0, Trade: 0, Waiver: 0, Unattributed: 0 } as Record<CountKey, number>
    const scopedPlayers = selectScopedPlayers(team.players, scope)
    scopedPlayers.forEach((p) => {
      const entry = acquisitions[p.id]
      const key: CountKey = entry?.type ?? UNATTRIBUTED
      counts[key] += 1
    })
    return {
      teamId: team.id,
      teamName: team.name,
      ownerName: team.owner,
      counts,
      total: scopedPlayers.length,
    }
  })
}

export default function AcquisitionBreakdown({ teams, leagueId }: Props) {
  const [state, setState] = useState<BreakdownState>({ status: 'loading' })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!leagueId) return
    let cancelled = false
    setState({ status: 'loading' })

    ;(async () => {
      try {
        const res = await fetch(`/api/acquisitions?league_id=${encodeURIComponent(leagueId)}`)
        let body: unknown
        try {
          body = await res.json()
        } catch {
          throw new Error(`The server didn't return a valid response (${res.status}). Try again in a moment.`)
        }
        if (!res.ok) {
          const message = (body as { error?: string } | null)?.error
          throw new Error(message || `Request failed (${res.status})`)
        }
        if (!cancelled) {
          setState({ status: 'ready', acquisitions: (body as { acquisitions: AcquisitionMap }).acquisitions })
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Something went wrong loading acquisition data.',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [leagueId, retryKey])

  if (!leagueId) {
    return (
      <div className="screen-enter">
        <PageHeader />
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#8b93a8', fontSize: 13, maxWidth: 480, margin: '0 auto' }}>
          Not available for the demo league — acquisition history needs a real Sleeper league to walk, and the demo
          roster isn't backed by one.
        </div>
      </div>
    )
  }

  if (state.status === 'loading') {
    return (
      <div className="screen-enter">
        <PageHeader />
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#8b93a8', fontSize: 13 }}>
          Loading acquisition history — this walks the league's entire season chain, so it may take a few seconds…
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="screen-enter">
        <PageHeader />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0' }}>
          <div style={{ textAlign: 'center', color: '#f87171', fontSize: 13 }}>{state.message}</div>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            style={{
              fontSize: 12,
              fontFamily: 'JetBrains Mono, monospace',
              color: '#f87171',
              background: 'none',
              border: '1px solid #4a1f1f',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-enter">
      <PageHeader />
      <TeamBreakdown teams={teams} acquisitions={state.acquisitions} />
    </div>
  )
}

function PageHeader() {
  return (
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
        Acquisitions
      </h1>
      <p style={{ color: '#8b93a8', fontSize: 13 }}>
        How every team built its current roster — startup draft, rookie draft, trade, or waiver
      </p>
    </div>
  )
}

function Legend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
      {COUNT_KEYS.map((key) => {
        const { color } = styleFor(key)
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#8b93a8', fontFamily: 'JetBrains Mono, monospace' }}>{key}</span>
          </div>
        )
      })}
    </div>
  )
}

function ScopeToggle({ scope, onChange }: { scope: SortScope; onChange: (s: SortScope) => void }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: '#131a2b',
        border: '1px solid #232c47',
        borderRadius: 7,
        padding: 3,
        gap: 2,
        marginBottom: 20,
      }}
    >
      {(['starters', 'starters_plus1', 'roster'] as SortScope[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={scope === s}
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
          {s === 'starters' ? 'Starters Only' : s === 'starters_plus1' ? 'Starters +1' : 'Full Roster'}
        </button>
      ))}
    </div>
  )
}

function TeamBreakdown({ teams, acquisitions }: { teams: Team[]; acquisitions: AcquisitionMap }) {
  const [scope, setScope] = useState<SortScope>('roster')
  const counts = useMemo(() => computeTeamCounts(teams, acquisitions, scope), [teams, acquisitions, scope])
  const chartRows = useMemo(() => [...counts].sort((a, b) => a.teamName.localeCompare(b.teamName)), [counts])

  return (
    <div>
      <ScopeToggle scope={scope} onChange={setScope} />
      <Legend />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {chartRows.map((row) => (
          <div key={row.teamId} className="row-enter" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }} title={row.teamName}>
                {row.teamName}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{row.ownerName}</div>
            </div>
            <div style={{ flex: 1, display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', background: '#131a2b' }}>
              {COUNT_KEYS.map((key) => {
                const count = row.counts[key]
                if (count === 0) return null
                const pct = row.total > 0 ? (count / row.total) * 100 : 0
                const { color } = styleFor(key)
                return (
                  <div
                    key={key}
                    title={`${key}: ${count}`}
                    style={{
                      width: `${pct}%`,
                      background: color,
                      transition: 'width 200ms ease-out',
                    }}
                  />
                )
              })}
            </div>
            <div style={{ width: 36, flexShrink: 0, textAlign: 'right', fontSize: 12, color: '#8b93a8', fontFamily: 'JetBrains Mono, monospace' }}>
              {row.total}
            </div>
          </div>
        ))}
      </div>

      <TeamTable rows={counts} />
    </div>
  )
}

interface ColumnDef {
  key: string
  label: string
  width: string
  description: string
  defaultDir: 'asc' | 'desc'
  sortValue: (r: TeamAcquisitionCounts) => number
  render: (r: TeamAcquisitionCounts) => React.ReactNode
}

const TABLE_COLUMNS: ColumnDef[] = [
  ...COUNT_KEYS.map(
    (key): ColumnDef => ({
      key,
      label: key.toUpperCase(),
      width: '110px',
      description: `Players currently on the roster acquired via ${key}`,
      defaultDir: 'desc',
      sortValue: (r) => r.counts[key],
      render: (r) => r.counts[key],
    })
  ),
  {
    key: 'total',
    label: 'TOTAL',
    width: '90px',
    description: 'Total rostered players',
    defaultDir: 'desc',
    sortValue: (r) => r.total,
    render: (r) => r.total,
  },
]

const TABLE_GRID_TEMPLATE = `minmax(0, 1fr) ${TABLE_COLUMNS.map((c) => c.width).join(' ')}`

function TeamTable({ rows }: { rows: TeamAcquisitionCounts[] }) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'total', dir: 'desc' })

  const sortedRows = useMemo(() => {
    const column = TABLE_COLUMNS.find((c) => c.key === sort.key)
    if (!column) return rows
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => sign * (column.sortValue(a) - column.sortValue(b)))
  }, [rows, sort])

  const toggleSort = (column: ColumnDef) => {
    setSort((prev) =>
      prev.key === column.key
        ? { key: column.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, dir: column.defaultDir }
    )
  }

  return (
    <div className="table-scroll" style={{ background: '#131a2b', border: '1px solid #232c47', borderRadius: 10 }} role="table" aria-label="Acquisitions by team">
      <div style={{ minWidth: 900 }}>
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns: TABLE_GRID_TEMPLATE,
            padding: '10px 20px',
            borderBottom: '1px solid #232c47',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <span
            role="columnheader"
            style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: '#8b93a8', fontFamily: 'JetBrains Mono, monospace' }}
          >
            TEAM / OWNER
          </span>
          {TABLE_COLUMNS.map((col) => {
            const active = sort.key === col.key
            const dir = active ? sort.dir : col.defaultDir
            const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
            return (
              <button
                key={col.key}
                type="button"
                role="columnheader"
                aria-sort={ariaSort as React.AriaAttributes['aria-sort']}
                title={col.description}
                aria-label={`${col.label}: ${col.description}`}
                onClick={() => toggleSort(col)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: active ? '#e2e4e9' : '#8b93a8',
                  fontFamily: 'JetBrains Mono, monospace',
                  borderBottom: '1px dotted currentColor',
                }}
              >
                {col.label}
                <span style={{ fontSize: 9, opacity: active ? 1 : 0.35 }}>{dir === 'asc' ? '▲' : '▼'}</span>
              </button>
            )
          })}
        </div>

        {sortedRows.map((row, idx) => (
          <div
            key={row.teamId}
            role="row"
            className="row-enter"
            style={{
              display: 'grid',
              gridTemplateColumns: TABLE_GRID_TEMPLATE,
              padding: '11px 20px',
              borderBottom: idx < sortedRows.length - 1 ? '1px solid #1b2438' : 'none',
              gap: 16,
              alignItems: 'center',
              animationDelay: `${Math.min(idx, 10) * 20}ms`,
            }}
          >
            <div role="cell" style={{ minWidth: 0 }}>
              <div
                title={row.teamName}
                style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {row.teamName}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.ownerName}
              </div>
            </div>
            {TABLE_COLUMNS.map((col) => (
              <div
                key={col.key}
                role="cell"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#a0a6b8' }}
              >
                {col.render(row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
