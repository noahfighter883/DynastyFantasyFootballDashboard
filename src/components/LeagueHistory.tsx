import { useEffect, useMemo, useState } from 'react'
import type { ApiLeagueHistoryPayload, OwnerHistory } from '../data/leagueHistoryData'

interface Props {
  leagueId: string
}

type HistoryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: ApiLeagueHistoryPayload }

function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

export default function LeagueHistory({ leagueId }: Props) {
  const [state, setState] = useState<HistoryState>({ status: 'loading' })
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setSelectedOwnerId(null)

    ;(async () => {
      try {
        const res = await fetch(`/api/league-history?league_id=${encodeURIComponent(leagueId)}`)
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
        if (!cancelled) setState({ status: 'ready', payload: body as ApiLeagueHistoryPayload })
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Something went wrong loading league history.',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [leagueId])

  if (state.status === 'loading') {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
        Loading league history — this walks every past season, so it may take a few seconds…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#f87171', fontSize: 13 }}>
        {state.message}
      </div>
    )
  }

  const { payload } = state
  const selectedOwner = selectedOwnerId
    ? payload.owners.find((o) => o.owner_id === selectedOwnerId) ?? null
    : null

  if (payload.owners.length === 0) {
    return (
      <div>
        <PageHeader />
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
          No completed seasons yet for this league.
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader />

      {payload.current_season_excluded && (
        <div style={{ marginBottom: 16, fontSize: 12, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
          {payload.current_season_excluded} season in progress — not yet reflected in history
        </div>
      )}

      {selectedOwner ? (
        <OwnerDetail owner={selectedOwner} onBack={() => setSelectedOwnerId(null)} />
      ) : (
        <AllTimeTable owners={payload.owners} onSelectOwner={setSelectedOwnerId} />
      )}
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
        League History
      </h1>
      <p style={{ color: '#6b7280', fontSize: 13 }}>
        All-time standings across every completed season · click a column to sort · click any owner for a
        year-by-year breakdown
      </p>
    </div>
  )
}

interface ColumnDef {
  key: string
  label: string
  width: string
  align?: 'right'
  defaultDir: 'asc' | 'desc'
  sortValue: (o: OwnerHistory) => number
  render: (o: OwnerHistory) => React.ReactNode
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'avg_finish',
    label: 'AVG FINISH',
    width: '90px',
    defaultDir: 'asc',
    sortValue: (o) => o.avg_finish ?? Infinity,
    render: (o) => (o.avg_finish != null ? o.avg_finish.toFixed(1) : '—'),
  },
  {
    key: 'championships',
    label: 'TITLES',
    width: '80px',
    defaultDir: 'desc',
    sortValue: (o) => o.championships,
    render: (o) => o.championships,
  },
  {
    key: 'playoff_appearances',
    label: 'PLAYOFFS',
    width: '90px',
    defaultDir: 'desc',
    sortValue: (o) => o.playoff_appearances,
    render: (o) => `${o.playoff_appearances}/${o.seasons_played}`,
  },
  {
    key: 'wins',
    label: 'RECORD',
    width: '100px',
    defaultDir: 'desc',
    sortValue: (o) => o.wins,
    render: (o) => `${o.wins}-${o.losses}${o.ties ? `-${o.ties}` : ''}`,
  },
  {
    key: 'point_differential',
    label: 'PT DIFF',
    width: '100px',
    defaultDir: 'desc',
    sortValue: (o) => o.point_differential,
    render: (o) => (o.point_differential > 0 ? `+${o.point_differential.toFixed(0)}` : o.point_differential.toFixed(0)),
  },
  {
    key: 'trades',
    label: 'TRADES',
    width: '80px',
    defaultDir: 'desc',
    sortValue: (o) => o.trades,
    render: (o) => o.trades,
  },
  {
    key: 'waiver_adds',
    label: 'WAIVERS',
    width: '80px',
    defaultDir: 'desc',
    sortValue: (o) => o.waiver_adds,
    render: (o) => o.waiver_adds,
  },
  {
    key: 'best_finish',
    label: 'BEST/WORST',
    width: '110px',
    defaultDir: 'asc',
    sortValue: (o) => o.best_finish ?? Infinity,
    render: (o) =>
      `${o.best_finish != null ? ordinal(o.best_finish) : '—'} / ${o.worst_finish != null ? ordinal(o.worst_finish) : '—'}`,
  },
  {
    key: 'seasons_played',
    label: 'SEASONS',
    width: '90px',
    defaultDir: 'desc',
    sortValue: (o) => o.seasons_played,
    render: (o) => o.seasons_played,
  },
]

const GRID_TEMPLATE = `44px 1fr ${COLUMNS.map((c) => c.width).join(' ')}`

function AllTimeTable({
  owners,
  onSelectOwner,
}: {
  owners: OwnerHistory[]
  onSelectOwner: (id: string) => void
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'avg_finish', dir: 'asc' })

  const sortedOwners = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sort.key)
    if (!column) return owners
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...owners].sort((a, b) => sign * (column.sortValue(a) - column.sortValue(b)))
  }, [owners, sort])

  const toggleSort = (column: ColumnDef) => {
    setSort((prev) =>
      prev.key === column.key
        ? { key: column.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, dir: column.defaultDir }
    )
  }

  return (
    <div className="table-scroll" style={{ background: '#131a2b', border: '1px solid #232c47', borderRadius: 10 }}>
      <div style={{ minWidth: 980 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_TEMPLATE,
            padding: '10px 20px',
            borderBottom: '1px solid #232c47',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: '#6b7280',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            RK
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: '#6b7280',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            TEAM / OWNER
          </span>
          {COLUMNS.map((col) => {
            const active = sort.key === col.key
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => toggleSort(col)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: active ? '#e2e4e9' : '#6b7280',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {col.label}
                <span style={{ fontSize: 9, opacity: active ? 1 : 0.35 }}>
                  {active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲'}
                </span>
              </button>
            )
          })}
        </div>

        {sortedOwners.map((owner, idx) => (
          <button
            key={owner.owner_id}
            type="button"
            onClick={() => onSelectOwner(owner.owner_id)}
            className="row-enter"
            style={{
              display: 'grid',
              gridTemplateColumns: GRID_TEMPLATE,
              width: '100%',
              padding: '14px 20px',
              border: 'none',
              borderBottom: idx < sortedOwners.length - 1 ? '1px solid #1b2438' : 'none',
              background: 'transparent',
              gap: 16,
              alignItems: 'center',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background 0.12s',
              animationDelay: `${Math.min(idx, 10) * 20}ms`,
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = '#1b2438'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
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
              {idx + 1}
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em', marginBottom: 2 }}>
                {owner.team_name}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{owner.display_name}</div>
            </div>

            {COLUMNS.map((col) => (
              <div
                key={col.key}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color:
                    col.key === 'championships' && owner.championships > 0
                      ? '#fbbf24'
                      : col.key === 'point_differential'
                        ? owner.point_differential > 0
                          ? '#34d399'
                          : owner.point_differential < 0
                            ? '#f87171'
                            : '#a0a6b8'
                        : '#a0a6b8',
                }}
              >
                {col.render(owner)}
              </div>
            ))}
          </button>
        ))}
      </div>
    </div>
  )
}

const DETAIL_COLUMNS = '80px 1fr 90px 110px 130px 80px 80px'

function OwnerDetail({ owner, onBack }: { owner: OwnerHistory; onBack: () => void }) {
  const seasonsDesc = [...owner.seasons].sort((a, b) => (b.season || '').localeCompare(a.season || ''))

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          color: '#6b7280',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
          fontFamily: 'inherit',
        }}
      >
        ← Back to all-time standings
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.01em', marginBottom: 2 }}>
          {owner.team_name}
        </div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>{owner.display_name}</div>
      </div>

      <div className="table-scroll" style={{ background: '#131a2b', border: '1px solid #232c47', borderRadius: 10 }}>
        <div style={{ minWidth: 680 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: DETAIL_COLUMNS,
              padding: '10px 20px',
              borderBottom: '1px solid #232c47',
              gap: 16,
              alignItems: 'center',
            }}
          >
            {['SEASON', 'TEAM NAME', 'FINISH', 'RECORD', 'PT DIFF', 'TRADES', 'WAIVERS'].map((h) => (
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

          {seasonsDesc.map((s, idx) => (
            <div
              key={s.season}
              style={{
                display: 'grid',
                gridTemplateColumns: DETAIL_COLUMNS,
                padding: '14px 20px',
                borderBottom: idx < seasonsDesc.length - 1 ? '1px solid #1b2438' : 'none',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#e2e4e9' }}>
                {s.season}
              </div>
              <div style={{ fontSize: 13, color: '#a0a6b8' }}>{s.team_name}</div>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  fontWeight: 600,
                  color: s.placement === 1 ? '#fbbf24' : '#e2e4e9',
                }}
              >
                {s.placement != null ? ordinal(s.placement) : '—'}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#a0a6b8' }}>
                {s.wins}-{s.losses}{s.ties ? `-${s.ties}` : ''}
              </div>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color: s.point_differential > 0 ? '#34d399' : s.point_differential < 0 ? '#f87171' : '#a0a6b8',
                }}
              >
                {s.point_differential > 0 ? `+${s.point_differential.toFixed(0)}` : s.point_differential.toFixed(0)}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#a0a6b8' }}>
                {s.trades}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#a0a6b8' }}>
                {s.waiver_adds}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
