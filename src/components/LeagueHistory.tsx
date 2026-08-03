import { useEffect, useState } from 'react'
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
        All-time standings across every completed season · click any owner for a year-by-year breakdown
      </p>
    </div>
  )
}

const COLUMNS = '44px 1fr 90px 90px 90px 130px 100px 90px'

function AllTimeTable({
  owners,
  onSelectOwner,
}: {
  owners: OwnerHistory[]
  onSelectOwner: (id: string) => void
}) {
  return (
    <div className="table-scroll" style={{ background: '#131a2b', border: '1px solid #232c47', borderRadius: 10 }}>
      <div style={{ minWidth: 760 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: COLUMNS,
            padding: '10px 20px',
            borderBottom: '1px solid #232c47',
            gap: 16,
            alignItems: 'center',
          }}
        >
          {['RK', 'TEAM / OWNER', 'AVG FINISH', 'TITLES', 'PLAYOFFS', 'RECORD', 'BEST/WORST', 'SEASONS'].map((h) => (
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

        {owners.map((owner, idx) => (
          <button
            key={owner.owner_id}
            type="button"
            onClick={() => onSelectOwner(owner.owner_id)}
            className="row-enter"
            style={{
              display: 'grid',
              gridTemplateColumns: COLUMNS,
              width: '100%',
              padding: '14px 20px',
              border: 'none',
              borderBottom: idx < owners.length - 1 ? '1px solid #1b2438' : 'none',
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

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#e2e4e9' }}>
              {owner.avg_finish != null ? owner.avg_finish.toFixed(1) : '—'}
            </div>

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: owner.championships > 0 ? '#fbbf24' : '#4b5563' }}>
              {owner.championships}
            </div>

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#a0a6b8' }}>
              {owner.playoff_appearances}/{owner.seasons_played}
            </div>

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#a0a6b8' }}>
              {owner.wins}-{owner.losses}{owner.ties ? `-${owner.ties}` : ''}
            </div>

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6b7280' }}>
              {owner.best_finish != null ? ordinal(owner.best_finish) : '—'} / {owner.worst_finish != null ? ordinal(owner.worst_finish) : '—'}
            </div>

            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#a0a6b8' }}>
              {owner.seasons_played}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

const DETAIL_COLUMNS = '80px 1fr 100px 120px 140px'

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
        <div style={{ minWidth: 560 }}>
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
            {['SEASON', 'TEAM NAME', 'FINISH', 'RECORD', 'PTS FOR/AGAINST'].map((h) => (
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
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6b7280' }}>
                {s.points_for.toFixed(1)} / {s.points_against.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
