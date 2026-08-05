import { useEffect, useMemo, useState } from 'react'
import type { ApiLeagueHistoryPayload, OwnerHistory } from '../data/leagueHistoryData'

interface Props {
  leagueId: string | null
  selectedOwnerId: string | null
  onSelectOwner: (id: string | null) => void
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

export default function LeagueHistory({ leagueId, selectedOwnerId, onSelectOwner }: Props) {
  const [state, setState] = useState<HistoryState>({ status: 'loading' })

  useEffect(() => {
    onSelectOwner(null)

    if (!leagueId) return

    let cancelled = false
    setState({ status: 'loading' })

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
      <div className="screen-enter">
        <PageHeader />
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
          No completed seasons yet for this league.
        </div>
      </div>
    )
  }

  return (
    <div className="screen-enter">
      <PageHeader />

      {payload.current_season_excluded && (
        <div style={{ marginBottom: 16, fontSize: 12, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
          {payload.current_season_excluded} season in progress — not yet reflected in history
        </div>
      )}

      {selectedOwner ? (
        <div className="screen-enter">
          <OwnerDetail owner={selectedOwner} />
        </div>
      ) : (
        <div className="screen-enter">
          <AllTimeTable owners={payload.owners} onSelectOwner={onSelectOwner} />
        </div>
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
  description: string
  // Draws a divider before this column, marking the start of a new group
  // (standings vs. league-activity stats) so the wall of numbers reads as
  // two sections instead of one flat list.
  groupStart?: boolean
  // Shown by default; the rest are revealed behind a "Show all columns"
  // toggle so a first glance isn't 10 same-weight numbers at once.
  core?: boolean
  defaultDir: 'asc' | 'desc'
  sortValue: (o: OwnerHistory) => number
  render: (o: OwnerHistory) => React.ReactNode
}

// Ordered as two groups: final standings (how a team actually did), then
// league activity (how active a manager was in trades/waivers). Grouping
// related columns together, rather than interleaving them, makes the wide
// table easier to scan.
const COLUMNS: ColumnDef[] = [
  {
    key: 'avg_finish',
    label: 'AVG FINISH',
    width: '90px',
    description: 'Average final standing across every completed season (1 = best)',
    core: true,
    defaultDir: 'asc',
    sortValue: (o) => o.avg_finish ?? Infinity,
    render: (o) => (o.avg_finish != null ? o.avg_finish.toFixed(1) : '—'),
  },
  {
    key: 'best_finish',
    label: 'BEST/WORST',
    width: '110px',
    description: 'Best and worst final standing in a single season',
    defaultDir: 'asc',
    sortValue: (o) => o.best_finish ?? Infinity,
    render: (o) =>
      `${o.best_finish != null ? ordinal(o.best_finish) : '—'} / ${o.worst_finish != null ? ordinal(o.worst_finish) : '—'}`,
  },
  {
    key: 'championships',
    label: 'TITLES',
    width: '80px',
    description: 'Championships won (1st place after the playoff bracket)',
    core: true,
    defaultDir: 'desc',
    sortValue: (o) => o.championships,
    render: (o) => o.championships,
  },
  {
    key: 'regular_season_titles',
    label: '#1 SEEDS',
    width: '90px',
    description: 'Seasons finished with the best regular-season record (before playoffs) -- a separate honor from winning the title',
    defaultDir: 'desc',
    sortValue: (o) => o.regular_season_titles,
    render: (o) => o.regular_season_titles,
  },
  {
    key: 'playoff_appearances',
    label: 'PLAYOFFS',
    width: '90px',
    description: 'Playoff appearances out of seasons played',
    defaultDir: 'desc',
    sortValue: (o) => o.playoff_appearances,
    render: (o) => `${o.playoff_appearances}/${o.seasons_played}`,
  },
  {
    key: 'wins',
    label: 'RECORD',
    width: '100px',
    description: 'All-time regular-season win-loss record',
    core: true,
    defaultDir: 'desc',
    sortValue: (o) => o.wins,
    render: (o) => `${o.wins}-${o.losses}${o.ties ? `-${o.ties}` : ''}`,
  },
  {
    key: 'point_differential',
    label: 'PT DIFF',
    width: '100px',
    description: 'All-time points scored minus points allowed',
    core: true,
    defaultDir: 'desc',
    sortValue: (o) => o.point_differential,
    render: (o) => (o.point_differential > 0 ? `+${o.point_differential.toFixed(0)}` : o.point_differential.toFixed(0)),
  },
  {
    key: 'seasons_played',
    label: 'SEASONS',
    width: '90px',
    description: 'Seasons this owner has been in the league',
    defaultDir: 'desc',
    sortValue: (o) => o.seasons_played,
    render: (o) => o.seasons_played,
  },
  {
    key: 'trades',
    label: 'TRADES',
    width: '80px',
    description: 'All-time completed trades',
    groupStart: true,
    defaultDir: 'desc',
    sortValue: (o) => o.trades,
    render: (o) => o.trades,
  },
  {
    key: 'waiver_adds',
    label: 'WAIVERS',
    width: '80px',
    description: 'All-time waiver-won pickups (not including free-agent adds)',
    defaultDir: 'desc',
    sortValue: (o) => o.waiver_adds,
    render: (o) => o.waiver_adds,
  },
]

const CORE_COLUMNS = COLUMNS.filter((c) => c.core)
const COLUMN_GAP = 16

// minmax(0, 1fr), not a bare 1fr -- the header and every row are each their
// own independent grid container, so without this a bare 1fr's implicit
// min-width:auto lets each one size the TEAM/OWNER column to its own
// content's minimum width, making the column a different actual pixel
// width per row and throwing off alignment with the header (see the same
// fix/explanation in StartupDraftReport.tsx).
function gridTemplate(columns: ColumnDef[]): string {
  return `44px minmax(0, 1fr) ${columns.map((c) => c.width).join(' ')}`
}

function tableMinWidth(columns: ColumnDef[]): number {
  const fixed = columns.reduce((sum, c) => sum + parseInt(c.width, 10), 0)
  const gaps = (columns.length + 1) * COLUMN_GAP
  return 44 + 220 + fixed + gaps
}

function AllTimeTable({
  owners,
  onSelectOwner,
}: {
  owners: OwnerHistory[]
  onSelectOwner: (id: string) => void
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'avg_finish', dir: 'asc' })
  const [showAllColumns, setShowAllColumns] = useState(false)
  const visibleColumns = showAllColumns ? COLUMNS : CORE_COLUMNS
  const gridTemplateColumns = gridTemplate(visibleColumns)
  const minWidth = tableMinWidth(visibleColumns)

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
    <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setShowAllColumns((v) => !v)}
        aria-pressed={showAllColumns}
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid #232c47',
          background: 'transparent',
          color: '#8b93a8',
          cursor: 'pointer',
        }}
      >
        {showAllColumns ? 'Show fewer columns' : 'Show all columns'}
      </button>
    </div>
    <div
      className="table-scroll"
      style={{ background: '#131a2b', border: '1px solid #232c47', borderRadius: 10 }}
      role="table"
      aria-label="All-time league standings"
    >
      <div style={{ minWidth }}>
        <div
          role="row"
          style={{
            display: 'grid',
            gridTemplateColumns,
            padding: '10px 20px',
            borderBottom: '1px solid #232c47',
            gap: COLUMN_GAP,
            alignItems: 'center',
          }}
        >
          <span
            role="columnheader"
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
            role="columnheader"
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
          {visibleColumns.map((col) => {
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
                  borderLeft: col.groupStart ? '1px solid #232c47' : 'none',
                  paddingLeft: col.groupStart ? COLUMN_GAP : 0,
                  marginLeft: col.groupStart ? -COLUMN_GAP : 0,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: active ? '#e2e4e9' : '#6b7280',
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

        {sortedOwners.map((owner, idx) => (
          <button
            key={owner.owner_id}
            type="button"
            onClick={() => onSelectOwner(owner.owner_id)}
            className="row-enter"
            style={{
              display: 'grid',
              gridTemplateColumns,
              width: '100%',
              padding: '14px 20px',
              border: 'none',
              borderBottom: idx < sortedOwners.length - 1 ? '1px solid #1b2438' : 'none',
              background: 'transparent',
              gap: COLUMN_GAP,
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

            <div style={{ minWidth: 0 }}>
              <div
                title={owner.team_name}
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: '-0.01em',
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {owner.team_name}
              </div>
              <div
                title={owner.display_name}
                style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {owner.display_name}
              </div>
            </div>

            {visibleColumns.map((col) => (
              <div
                key={col.key}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  borderLeft: col.groupStart ? '1px solid #1b2438' : 'none',
                  paddingLeft: col.groupStart ? COLUMN_GAP : 0,
                  marginLeft: col.groupStart ? -COLUMN_GAP : 0,
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

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          fontSize: 11,
          color: '#4b5563',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        <span>TITLES = won it all · #1 SEEDS = best regular-season record · PT DIFF = points for − against</span>
        <span style={{ marginLeft: 'auto' }}>
          Owners tracked individually — a roster that changed hands shows as separate rows
        </span>
      </div>
    </>
  )
}

const DETAIL_COLUMNS = '80px 1fr 90px 110px 90px 100px 80px 80px'

function OwnerDetail({ owner }: { owner: OwnerHistory }) {
  const seasonsDesc = [...owner.seasons].sort((a, b) => (b.season || '').localeCompare(a.season || ''))

  return (
    <div>
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
            {['SEASON', 'TEAM NAME', 'FINISH', 'RECORD', 'PTS FOR', 'PTS AGAINST', 'TRADES', 'WAIVERS'].map((h) => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#a0a6b8' }}>
                  {s.wins}-{s.losses}{s.ties ? `-${s.ties}` : ''}
                </span>
                {s.won_regular_season && (
                  <span
                    title="Regular season #1 seed"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#fbbf24',
                      border: '1px solid #4a3f1a',
                      borderRadius: 3,
                      padding: '1px 4px',
                    }}
                  >
                    #1 SEED
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color: s.point_differential > 0 ? '#34d399' : '#a0a6b8',
                }}
              >
                {s.points_for.toFixed(1)}
              </div>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color: s.point_differential < 0 ? '#f87171' : '#a0a6b8',
                }}
              >
                {s.points_against.toFixed(1)}
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
