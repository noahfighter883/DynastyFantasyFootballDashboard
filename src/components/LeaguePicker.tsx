export interface LeagueSummary {
  league_id: string
  name: string
  season: string
  total_rosters: number | null
}

interface Props {
  username: string
  leagues: LeagueSummary[]
  loading: boolean
  onSelect: (leagueId: string) => void
  onBack: () => void
}

export default function LeaguePicker({ username, leagues, loading, onSelect, onBack }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#0a0f1e',
        color: '#e2e4e9',
      }}
    >
      <div style={{ maxWidth: 460, width: '100%' }}>
        <h1
          style={{
            fontFamily: 'Fraunces, serif',
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 24,
            letterSpacing: '-0.01em',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          Which league?
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
          {username} is in {leagues.length} leagues -- pick one.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leagues.map((league) => (
            <button
              key={league.league_id}
              onClick={() => onSelect(league.league_id)}
              disabled={loading}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#131a2b',
                border: '1px solid #232c47',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 14,
                color: '#e2e4e9',
                textAlign: 'left',
                cursor: loading ? 'default' : 'pointer',
              }}
            >
              <span>{league.name}</span>
              <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'JetBrains Mono, monospace' }}>
                {league.season}
                {league.total_rosters ? ` · ${league.total_rosters} teams` : ''}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onBack}
          disabled={loading}
          style={{
            marginTop: 20,
            width: '100%',
            background: 'transparent',
            color: '#6b7280',
            border: 'none',
            fontSize: 13,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          ← Back
        </button>
      </div>
    </div>
  )
}
