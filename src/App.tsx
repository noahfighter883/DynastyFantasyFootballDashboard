import { useEffect, useState } from "react";
import {
  DEMO_LEAGUE,
  buildLeagueFromApiPayload,
  type ApiLeaguePayload,
} from "./data/leagueData";
import LeagueOverview from "./components/LeagueOverview";
import TeamDetail from "./components/TeamDetail";
import PositionComparison from "./components/PositionComparison";
import FeasibilityComparison from "./components/FeasibilityComparison";
import LeagueHistory from "./components/LeagueHistory";
import LeagueEntry from "./components/LeagueEntry";
import LeaguePicker, { type LeagueSummary } from "./components/LeaguePicker";
import type { Screen, Position, Team } from "./types";

const LAST_LEAGUE_KEY = "dynastyevaluator:lastLeagueId";
const DEMO_SEASON = "2026";

// Sleeper league IDs are long numeric snowflakes; pull one out of a pasted
// URL (e.g. https://sleeper.com/leagues/1312205516633554944/team) or accept
// it bare.
function extractLeagueId(input: string): string | null {
  const match = input.trim().match(/(\d{15,20})/);
  return match ? match[1] : null;
}

type LoadState =
  | { status: "entry" }
  | { status: "loading" }
  | { status: "picking"; username: string; leagues: LeagueSummary[] }
  | { status: "error"; message: string }
  | { status: "ready"; teams: Team[]; season: string; isDemo: boolean; leagueId: string | null };

export default function App() {
  const [load, setLoad] = useState<LoadState>({ status: "entry" });
  const [screen, setScreen] = useState<Screen>("overview");
  const [selectedTeamId, setSelectedTeamId] = useState<
    string | null
  >(null);
  const [cameFrom, setCameFrom] = useState<
    "overview" | "position" | "feasibility"
  >("overview");
  const [initialPosFilter, setInitialPosFilter] = useState<
    Position | "ALL"
  >("ALL");

  // Fetches a JSON API response, treating a non-JSON body (e.g. a gateway
  // error page) as its own distinct failure rather than an unreadable crash.
  const fetchJson = async (path: string): Promise<unknown> => {
    const res = await fetch(path);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new Error(`The server didn't return a valid response (${res.status}). Try again in a moment.`);
    }
    if (!res.ok) {
      const message = (body as { error?: string } | null)?.error;
      throw new Error(message || `Request failed (${res.status})`);
    }
    return body;
  };

  const loadLeagueById = async (leagueId: string) => {
    setLoad({ status: "loading" });
    try {
      const payload = (await fetchJson(
        `/api/league?league_id=${encodeURIComponent(leagueId)}`
      )) as ApiLeaguePayload;
      const teams = buildLeagueFromApiPayload(payload);
      localStorage.setItem(LAST_LEAGUE_KEY, leagueId);
      const url = new URL(window.location.href);
      url.searchParams.set("league_id", leagueId);
      window.history.replaceState(null, "", url);
      setScreen("overview");
      setSelectedTeamId(null);
      setLoad({ status: "ready", teams, season: payload.season, isDemo: false, leagueId });
    } catch (e) {
      setLoad({
        status: "error",
        message: e instanceof Error ? e.message : "Something went wrong loading that league.",
      });
    }
  };

  const loadByUsername = async (username: string) => {
    setLoad({ status: "loading" });
    try {
      const body = (await fetchJson(`/api/username?username=${encodeURIComponent(username)}`)) as {
        leagues: LeagueSummary[];
      };
      if (body.leagues.length === 0) {
        setLoad({ status: "error", message: `No Sleeper leagues found for username '${username}'.` });
      } else if (body.leagues.length === 1) {
        await loadLeagueById(body.leagues[0].league_id);
      } else {
        setLoad({ status: "picking", username, leagues: body.leagues });
      }
    } catch (e) {
      setLoad({
        status: "error",
        message: e instanceof Error ? e.message : "Something went wrong looking up that username.",
      });
    }
  };

  // A league ID/URL goes straight to that league; anything else is treated
  // as a Sleeper username and looked up instead.
  const loadLeague = async (rawInput: string) => {
    const leagueId = extractLeagueId(rawInput);
    if (leagueId) {
      await loadLeagueById(leagueId);
      return;
    }
    const username = rawInput.trim();
    if (!username) {
      setLoad({ status: "error", message: "Enter a league ID/URL or your Sleeper username." });
      return;
    }
    await loadByUsername(username);
  };

  const viewDemo = () => {
    setScreen("overview");
    setSelectedTeamId(null);
    setLoad({ status: "ready", teams: DEMO_LEAGUE, season: DEMO_SEASON, isDemo: true, leagueId: null });
  };

  const changeLeague = () => setLoad({ status: "entry" });

  // On first load, try the league ID from the URL, then the last one used.
  useEffect(() => {
    const fromUrl = new URL(window.location.href).searchParams.get("league_id");
    const fromStorage = localStorage.getItem(LAST_LEAGUE_KEY);
    const leagueId = fromUrl || fromStorage;
    if (leagueId) loadLeagueById(leagueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (load.status === "picking") {
    return (
      <LeaguePicker
        username={load.username}
        leagues={load.leagues}
        loading={false}
        onSelect={loadLeagueById}
        onBack={changeLeague}
      />
    );
  }

  if (load.status === "entry" || load.status === "loading" || load.status === "error") {
    return (
      <LeagueEntry
        loading={load.status === "loading"}
        error={load.status === "error" ? load.message : null}
        onSubmit={loadLeague}
        onDemo={viewDemo}
      />
    );
  }

  const { teams, season, isDemo, leagueId } = load;

  const selectedTeam = selectedTeamId
    ? (teams.find((t) => t.id === selectedTeamId) ?? null)
    : null;

  const goToTeam = (id: string, pos?: Position) => {
    setCameFrom(
      screen === "position" || screen === "feasibility" ? screen : "overview",
    );
    setInitialPosFilter(pos ?? "ALL");
    setSelectedTeamId(id);
    setScreen("team");
  };

  const goBack = () => setScreen(cameFrom);

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0a0f1e", color: "#e2e4e9" }}
    >
      {/* Top nav */}
      <header
        style={{
          borderBottom: "1px solid #232c47",
          background: "#0a0f1e",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          className="app-header-grid"
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "0 24px",
          }}
        >
          {/* Left column: back button + brand */}
          <div
            className="app-header-left"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              minWidth: 0,
            }}
          >
            {/* Back button -- only visible on the team detail screen, sits at the far left */}
            {screen === "team" && selectedTeam && (
              <button
                onClick={goBack}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "#6b7280",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color =
                    "#e2e4e9";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color =
                    "#6b7280";
                }}
              >
                ← Back
              </button>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "Fraunces, serif",
                  fontStyle: "italic",
                  fontWeight: 600,
                  fontSize: 17,
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                DynastyEvaluator
              </span>
              <span
                className="app-header-badge"
                style={{
                  fontSize: 11,
                  fontFamily: "JetBrains Mono, monospace",
                  color: "#6b7280",
                  background: "#1b2438",
                  padding: "2px 6px",
                  borderRadius: 4,
                  border: "1px solid #232c47",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                }}
              >
                {isDemo ? `Demo League · ${season}` : `${teams.length}-Team League · ${season}`}
              </span>
            </div>
          </div>

          {/* Center column: nav */}
          <nav
            className="app-header-nav"
            style={{
              display: "flex",
              gap: 4,
              justifySelf: "center",
              minWidth: 0,
            }}
          >
            {(
              [
                { id: "overview", label: "League Overview" },
                {
                  id: "position",
                  label: "Position Comparison",
                },
                {
                  id: "feasibility",
                  label: "Feasibility",
                },
                ...(isDemo ? [] : [{ id: "history", label: "League History" }]),
              ] as { id: Screen; label: string }[]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setScreen(id)}
                aria-current={screen === id ? "page" : undefined}
                style={{
                  padding: "4px 12px",
                  borderRadius: 5,
                  fontSize: 13,
                  fontWeight: screen === id ? 500 : 400,
                  background:
                    screen === id ? "#1c2540" : "transparent",
                  color: screen === id ? "#e2e4e9" : "#6b7280",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Right column: owner's name on team detail, or a way back to the entry screen */}
          <div
            className="app-header-owner"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
              textAlign: "right",
              fontSize: 13,
              color: "#e2e4e9",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {screen === "team" && selectedTeam ? selectedTeam.owner : null}
            <button
              onClick={changeLeague}
              style={{
                fontSize: 12,
                color: "#6b7280",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Change league
            </button>
          </div>
        </div>
      </header>

      {/* Screens */}
      <main
        key={screen}
        className="screen-enter"
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "24px 24px",
        }}
      >
        {screen === "overview" && (
          <LeagueOverview
            teams={teams}
            season={season}
            onSelectTeam={goToTeam}
          />
        )}
        {screen === "team" && selectedTeam && (
          <TeamDetail
            key={selectedTeam.id}
            team={selectedTeam}
            cameFrom={cameFrom}
            initialPosFilter={initialPosFilter}
          />
        )}
        {screen === "position" && (
          <PositionComparison
            teams={teams}
            onSelectTeam={goToTeam}
          />
        )}
        {screen === "feasibility" && (
          <FeasibilityComparison
            teams={teams}
            onSelectTeam={goToTeam}
          />
        )}
        {screen === "history" && leagueId && (
          <LeagueHistory leagueId={leagueId} />
        )}
      </main>

      {/* How it works */}
      {screen !== "feasibility" && screen !== "history" && (
        <footer
          style={{
            borderTop: "1px solid #232c47",
            marginTop: 40,
          }}
        >
          <div
            style={{
              maxWidth: 1400,
              margin: "0 auto",
              padding: "20px 24px 32px",
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: "#6b7280",
                lineHeight: 1.6,
                maxWidth: 760,
              }}
            >
              <span style={{ color: "#a0a6b8", fontWeight: 600 }}>
                How scoring works:
              </span>{" "}
              team value uses an average-rank system — lower average
              rank means a stronger team, the same logic as golf
              scoring — rather than a raw point total, so a team's
              score reflects player quality regardless of roster
              size. Values are shown in round.pick notation (e.g.{" "}
              <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
                3.3
              </span>{" "}
              = the equivalent 3rd-round, 3rd-pick draft slot in a{" "}
              {teams.length}-team snake draft). Only QB/RB/WR/TE are
              covered — kickers, defenses, and IDP are ignored.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
