import { useEffect, useMemo, useRef, useState } from 'react'
import type { ApiStartupDraftPayload, StartupDraftPick } from '../data/startupDraftData'

interface Props {
  leagueId: string | null
}

type StartupDraftState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; payload: ApiStartupDraftPayload }

const POSITION_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3 }

export default function StartupDraftReport({ leagueId }: Props) {
  const [state, setState] = useState<StartupDraftState>({ status: 'loading' })

  useEffect(() => {
    if (!leagueId) return

    let cancelled = false
    setState({ status: 'loading' })

    ;(async () => {
      try {
        const res = await fetch(`/api/startup-draft?league_id=${encodeURIComponent(leagueId)}`)
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
        if (!cancelled) setState({ status: 'ready', payload: body as ApiStartupDraftPayload })
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Something went wrong loading the startup draft.',
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
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#8b93a8', fontSize: 13 }}>
        Loading startup draft — walking back to the league's first season…
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

  if (!payload.has_startup_draft || payload.picks.length === 0) {
    return (
      <div className="screen-enter">
        <PageHeader season={payload.season} />
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#8b93a8', fontSize: 13 }}>
          No completed startup draft found for this league.
        </div>
      </div>
    )
  }

  return (
    <div className="screen-enter">
      <PageHeader season={payload.season} />
      <RisersFallersHighlights picks={payload.picks} />
      <FullPicksTable picks={payload.picks} />
    </div>
  )
}

function PageHeader({ season }: { season: string | null }) {
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
        Startup Draft
      </h1>
      <p style={{ color: '#8b93a8', fontSize: 13 }}>
        Every skill-position player taken in the {season ?? ''} startup draft · click a column to sort
      </p>
    </div>
  )
}

function formatMovement(movement: number | null): string {
  if (movement == null) return '—'
  return movement > 0 ? `+${movement}` : `${movement}`
}

function movementColor(movement: number | null): string {
  if (movement == null) return '#a0a6b8'
  if (movement > 0) return '#34d399'
  if (movement < 0) return '#f87171'
  return '#a0a6b8'
}

function RisersFallersHighlights({ picks }: { picks: StartupDraftPick[] }) {
  const withMovement = picks.filter((p) => p.movement != null) as (StartupDraftPick & { movement: number })[]
  const risers = [...withMovement].sort((a, b) => b.movement - a.movement).slice(0, 5)
  const fallers = [...withMovement].sort((a, b) => a.movement - b.movement).slice(0, 5)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
      <HighlightCard title="BIGGEST RISERS" accent="#34d399" rows={risers} />
      <HighlightCard title="BIGGEST FALLERS" accent="#f87171" rows={fallers} />
    </div>
  )
}

function HighlightCard({
  title,
  accent,
  rows,
}: {
  title: string
  accent: string
  rows: (StartupDraftPick & { movement: number })[]
}) {
  return (
    <div style={{ background: '#131a2b', border: '1px solid #232c47', borderRadius: 10, padding: '14px 18px' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: accent,
          fontFamily: 'JetBrains Mono, monospace',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((p) => (
          <div key={p.player_id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
              <span style={{ fontSize: 11, color: '#8b93a8', marginLeft: 6, fontFamily: 'JetBrains Mono, monospace' }}>
                Pick {p.original_pick_no} → #{p.cohort_rank}
              </span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: accent, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
              {formatMovement(p.movement)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ColumnDef {
  key: string
  label: string
  width: string
  description: string
  groupStart?: boolean
  core?: boolean
  ellipsis?: boolean
  defaultDir: 'asc' | 'desc'
  sortValue: (p: StartupDraftPick) => number | string
  render: (p: StartupDraftPick) => React.ReactNode
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'position',
    label: 'POS',
    width: '60px',
    description: 'Position',
    core: true,
    defaultDir: 'asc',
    sortValue: (p) => POSITION_ORDER[p.position] ?? 99,
    render: (p) => p.position,
  },
  {
    key: 'round_pick',
    label: 'RD.PK',
    width: '90px',
    description: 'Round.pick they were taken at in the startup draft',
    groupStart: true,
    core: true,
    defaultDir: 'asc',
    sortValue: (p) => p.original_pick_no,
    render: (p) => `${p.round}.${String(p.pick_in_round ?? '?').padStart(2, '0')}`,
  },
  {
    key: 'dynasty_overall_rank',
    label: 'DYN RANK',
    width: '90px',
    description: 'Current dynasty rank, league-wide (same number shown in League Overview / Team Detail)',
    core: true,
    defaultDir: 'asc',
    sortValue: (p) => p.dynasty_overall_rank ?? Infinity,
    render: (p) => p.dynasty_overall_rank ?? '—',
  },
  {
    key: 'cohort_rank',
    label: 'DRAFT CLASS RANK',
    width: '130px',
    description: 'Rank among ONLY the players taken in this startup draft, by current dynasty rank -- apples-to-apples with the original pick number',
    defaultDir: 'asc',
    sortValue: (p) => p.cohort_rank ?? Infinity,
    render: (p) => (p.cohort_rank != null ? `#${p.cohort_rank}` : '—'),
  },
  {
    key: 'movement',
    label: 'MOVEMENT',
    width: '90px',
    description: 'Original pick number minus draft-class rank -- positive means risen since the draft',
    core: true,
    defaultDir: 'desc',
    sortValue: (p) => p.movement ?? -Infinity,
    render: (p) => formatMovement(p.movement),
  },
  {
    key: 'age_at_draft',
    label: 'AGE (DRAFT)',
    width: '90px',
    description: 'Age at the time of the startup draft',
    groupStart: true,
    defaultDir: 'asc',
    sortValue: (p) => p.age_at_draft ?? Infinity,
    render: (p) => p.age_at_draft ?? '—',
  },
  {
    key: 'age_now',
    label: 'AGE (NOW)',
    width: '90px',
    description: 'Current age',
    defaultDir: 'asc',
    sortValue: (p) => p.age_now ?? Infinity,
    render: (p) => p.age_now ?? '—',
  },
  {
    key: 'drafted_by_team_name',
    label: 'DRAFTED BY',
    width: '130px',
    description: 'Team that made this pick in the startup draft',
    ellipsis: true,
    defaultDir: 'asc',
    sortValue: (p) => p.drafted_by_team_name ?? 'zzz',
    render: (p) => p.drafted_by_team_name ?? '—',
  },
  {
    key: 'current_team_name',
    label: 'CURRENT TEAM',
    width: '140px',
    description: 'Team currently rostering this player, if any',
    groupStart: true,
    core: true,
    ellipsis: true,
    defaultDir: 'asc',
    sortValue: (p) => p.current_team_name ?? 'zzz',
    render: (p) => p.current_team_name ?? 'Free Agent',
  },
]

const CORE_COLUMNS = COLUMNS.filter((c) => c.core)
const COLUMN_GAP = 10

// minmax(150px, 1fr), not a bare 1fr -- the header and every row are each
// their own independent grid container (not rows of one shared grid), so
// without an explicit minimum a bare 1fr's implicit min-width:auto lets each
// one size the PLAYER column to its own content's minimum width (driven by
// the longest unbreakable word in that particular name), making the column a
// different actual pixel width per row and throwing off alignment with the
// header. The explicit 150px floor also keeps names readable on one line
// even when the table's minWidth is trimmed tight to fit smaller screens.
function gridTemplate(columns: ColumnDef[]): string {
  return `44px minmax(150px, 1fr) ${columns.map((c) => c.width).join(' ')}`
}

function tableMinWidth(columns: ColumnDef[]): number {
  const fixed = columns.reduce((sum, c) => sum + parseInt(c.width, 10), 0)
  const gaps = (columns.length + 1) * COLUMN_GAP
  return 44 + 150 + fixed + gaps
}

const POSITION_FILTERS = ['ALL', 'QB', 'RB', 'WR', 'TE'] as const
type PositionFilter = (typeof POSITION_FILTERS)[number]

function matchesSearch(pick: StartupDraftPick, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    pick.name.toLowerCase().includes(q) ||
    (pick.current_team_name?.toLowerCase().includes(q) ?? false) ||
    (pick.drafted_by_team_name?.toLowerCase().includes(q) ?? false)
  )
}

function uniqueTeamNames(picks: StartupDraftPick[], key: 'drafted_by_team_name' | 'current_team_name'): string[] {
  const names = new Set<string>()
  picks.forEach((p) => {
    const name = p[key]
    if (name) names.add(name)
  })
  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

function FullPicksTable({ picks }: { picks: StartupDraftPick[] }) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'round_pick', dir: 'asc' })
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL')
  const [draftedByFilter, setDraftedByFilter] = useState('ALL')
  const [currentTeamFilter, setCurrentTeamFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)

  const visibleColumns = showAllColumns ? COLUMNS : CORE_COLUMNS
  const gridTemplateColumns = gridTemplate(visibleColumns)
  const minWidth = tableMinWidth(visibleColumns)

  const draftedByOptions = useMemo(() => uniqueTeamNames(picks, 'drafted_by_team_name'), [picks])
  const currentTeamOptions = useMemo(() => uniqueTeamNames(picks, 'current_team_name'), [picks])

  const filteredPicks = useMemo(() => {
    return picks.filter(
      (p) =>
        (positionFilter === 'ALL' || p.position === positionFilter) &&
        (draftedByFilter === 'ALL' || p.drafted_by_team_name === draftedByFilter) &&
        (currentTeamFilter === 'ALL' || p.current_team_name === currentTeamFilter) &&
        matchesSearch(p, search)
    )
  }, [picks, positionFilter, draftedByFilter, currentTeamFilter, search])

  const sortedPicks = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sort.key)
    if (!column) return filteredPicks
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...filteredPicks].sort((a, b) => {
      const av = column.sortValue(a)
      const bv = column.sortValue(b)
      if (typeof av === 'string' || typeof bv === 'string') {
        return sign * String(av).localeCompare(String(bv))
      }
      return sign * (av - bv)
    })
  }, [filteredPicks, sort])

  const toggleSort = (column: ColumnDef) => {
    setSort((prev) =>
      prev.key === column.key
        ? { key: column.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, dir: column.defaultDir }
    )
  }

  // A sticky header can't live inside the same overflow-x: auto box as the
  // rows -- browsers force overflow-y to "auto" the moment overflow-x isn't
  // "visible" (there's no way to opt out of this even with an explicit
  // overflow-y: visible), which makes that box position:sticky's containing
  // block instead of the page, so the header would never actually move as
  // the page scrolls. Split into two panes instead: the header pane is
  // sticky and clips its own horizontal overflow (overflow-x: hidden, never
  // shows a scrollbar), the body pane scrolls normally, and a scroll
  // handler keeps them in horizontal sync.
  const syncHeaderScroll = () => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Filter by position">
          {POSITION_FILTERS.map((pos) => {
            const active = positionFilter === pos
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setPositionFilter(pos)}
                aria-pressed={active}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: active ? '1px solid #3b82f6' : '1px solid #232c47',
                  background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: active ? '#60a5fa' : '#8b93a8',
                  cursor: 'pointer',
                }}
              >
                {pos}
              </button>
            )
          })}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search player or team…"
          aria-label="Search by player or team name"
          style={{
            flex: '1 1 200px',
            minWidth: 160,
            maxWidth: 280,
            fontSize: 13,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #232c47',
            background: '#0d1120',
            color: '#e2e4e9',
          }}
        />

        <select
          value={draftedByFilter}
          onChange={(e) => setDraftedByFilter(e.target.value)}
          aria-label="Filter by drafted-by team"
          style={{
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #232c47',
            background: '#0d1120',
            color: draftedByFilter === 'ALL' ? '#8b93a8' : '#e2e4e9',
            maxWidth: 160,
          }}
        >
          <option value="ALL">Drafted by: all teams</option>
          {draftedByOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={currentTeamFilter}
          onChange={(e) => setCurrentTeamFilter(e.target.value)}
          aria-label="Filter by current team"
          style={{
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #232c47',
            background: '#0d1120',
            color: currentTeamFilter === 'ALL' ? '#8b93a8' : '#e2e4e9',
            maxWidth: 160,
          }}
        >
          <option value="ALL">Current team: all teams</option>
          {currentTeamOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <span style={{ fontSize: 12, color: '#8b93a8', marginLeft: 'auto' }}>
          {sortedPicks.length} of {picks.length} players
        </span>

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
        style={{ background: '#131a2b', border: '1px solid #232c47', borderRadius: 10 }}
        role="table"
        aria-label="Startup draft picks"
        aria-rowcount={sortedPicks.length + 1}
      >
        <div
          ref={headerScrollRef}
          role="rowgroup"
          style={{
            overflowX: 'hidden',
            // Reserves the same permanent scrollbar gutter as the body pane
            // below (.table-scroll's scrollbar-gutter: stable) -- without
            // this, the body pane is a few pixels narrower than the header
            // pane whenever its scrollbar gutter is reserved, so the two
            // panes' identical grid templates compute to different actual
            // widths and every column drifts out of alignment.
            overflowY: 'auto',
            scrollbarGutter: 'stable',
            position: 'sticky',
            // Sits just below the app's own sticky top nav (53px tall,
            // z-index 50) so both stay visible while scrolling this long table.
            top: 53,
            zIndex: 10,
            background: '#131a2b',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
          }}
        >
          <div
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns,
              minWidth,
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
                color: '#8b93a8',
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
                color: '#8b93a8',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              PLAYER
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
        </div>

        <div
          ref={bodyScrollRef}
          onScroll={syncHeaderScroll}
          className="table-scroll"
          role="rowgroup"
          style={{ borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}
        >
          {sortedPicks.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#8b93a8', fontSize: 13 }}>
              No players match the current filters
              {search ? ` (search "${search}")` : ''}
              {positionFilter !== 'ALL' ? ` · ${positionFilter}` : ''}
              {draftedByFilter !== 'ALL' ? ` · drafted by ${draftedByFilter}` : ''}
              {currentTeamFilter !== 'ALL' ? ` · on ${currentTeamFilter}` : ''}.
            </div>
          ) : (
            <div style={{ minWidth }}>
              {sortedPicks.map((pick, idx) => (
                <div
                  key={pick.player_id}
                  className="row-enter"
                  role="row"
                  aria-rowindex={idx + 2}
                  style={{
                    display: 'grid',
                    gridTemplateColumns,
                    padding: '11px 20px',
                    borderBottom: idx < sortedPicks.length - 1 ? '1px solid #1b2438' : 'none',
                    gap: COLUMN_GAP,
                    alignItems: 'center',
                    animationDelay: `${Math.min(idx, 10) * 12}ms`,
                  }}
                >
                  <div
                    role="cell"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 13,
                      fontWeight: 600,
                      color: idx < 3 ? '#3b82f6' : '#4b5563',
                      textAlign: 'left',
                    }}
                  >
                    {idx + 1}
                  </div>

                  <div role="cell" style={{ fontWeight: 500, fontSize: 13, letterSpacing: '-0.01em' }}>
                    {pick.name}
                  </div>

                  {visibleColumns.map((col) => (
                    <div
                      key={col.key}
                      role="cell"
                      title={col.ellipsis ? String(col.render(pick)) : undefined}
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                        borderLeft: col.groupStart ? '1px solid #1b2438' : 'none',
                        paddingLeft: col.groupStart ? COLUMN_GAP : 0,
                        marginLeft: col.groupStart ? -COLUMN_GAP : 0,
                        color: col.key === 'movement' ? movementColor(pick.movement) : '#a0a6b8',
                        overflow: col.ellipsis ? 'hidden' : undefined,
                        textOverflow: col.ellipsis ? 'ellipsis' : undefined,
                        whiteSpace: col.ellipsis ? 'nowrap' : undefined,
                      }}
                    >
                      {col.render(pick)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
