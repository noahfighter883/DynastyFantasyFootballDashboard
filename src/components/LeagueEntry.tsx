import { useState } from 'react'

interface Props {
  loading: boolean
  error: string | null
  onSubmit: (input: string) => void
  onDemo: () => void
}

export default function LeagueEntry({ loading, error, onSubmit, onDemo }: Props) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && !loading) onSubmit(value)
  }

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
            fontSize: 32,
            letterSpacing: '-0.01em',
            marginBottom: 8,
            textAlign: 'center',
          }}
        >
          DynastyEvaluator
        </h1>
        <p style={{ color: '#a0a6b8', fontSize: 15, textAlign: 'center', marginBottom: 12, lineHeight: 1.5 }}>
          A dynasty fantasy football analytics dashboard that answers the question every
          dynasty manager eventually asks: if my league re-drafted from scratch today, how
          would every team actually stack up?
        </p>
        <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 1.6 }}>
          Enter your Sleeper username, or paste your dynasty league's ID or URL, to
          generate power rankings, position breakdowns, and a draft capital curve for every team.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Sleeper username, league ID, or league URL"
            disabled={loading}
            style={{
              background: '#131a2b',
              border: '1px solid #232c47',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 14,
              color: '#e2e4e9',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading || !value.trim()}
            style={{
              background: loading || !value.trim() ? '#1c2540' : '#4f5fe0',
              color: loading || !value.trim() ? '#6b7280' : '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || !value.trim() ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Loading your league…' : 'Generate My Dashboard'}
          </button>
        </form>

        {error && (
          <p
            style={{
              marginTop: 12,
              fontSize: 13,
              color: '#f87171',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '24px 0',
            color: '#4b5563',
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: '#232c47' }} />
          or
          <div style={{ flex: 1, height: 1, background: '#232c47' }} />
        </div>

        <button
          onClick={onDemo}
          disabled={loading}
          style={{
            width: '100%',
            background: 'transparent',
            color: '#a0a6b8',
            border: '1px solid #232c47',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 13,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          View a demo league instead
        </button>

        <p style={{ marginTop: 24, fontSize: 11, color: '#4b5563', textAlign: 'center', lineHeight: 1.6 }}>
          Only QB/RB/WR/TE are covered for now — kickers, defenses, and IDP are ignored.
          Your league's Sleeper data is public by ID; no login or API key needed.
        </p>
      </div>
    </div>
  )
}
