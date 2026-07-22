import { useState } from "react";
import { LEAGUE } from "./data/leagueData";
import LeagueOverview from "./components/LeagueOverview";
import TeamDetail from "./components/TeamDetail";
import PositionComparison from "./components/PositionComparison";
import type { Screen, Position } from "./types";

export default function App() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [selectedTeamId, setSelectedTeamId] = useState<
    string | null
  >(null);
  const [cameFrom, setCameFrom] = useState<
    "overview" | "position"
  >("overview");
  const [initialPosFilter, setInitialPosFilter] = useState<
    Position | "ALL"
  >("ALL");

  const selectedTeam = selectedTeamId
    ? (LEAGUE.find((t) => t.id === selectedTeamId) ?? null)
    : null;

  const goToTeam = (id: string, pos?: Position) => {
    setCameFrom(
      screen === "position" ? "position" : "overview",
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
              justifySelf: "start",
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
                }}
              >
                2026 · 12-Team PPR
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

          {/* Right column: owner's name on team detail */}
          <div
            className="app-header-owner"
            style={{
              justifySelf: "end",
              fontSize: 13,
              color: "#e2e4e9",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {screen === "team" && selectedTeam
              ? selectedTeam.owner
              : null}
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
            teams={LEAGUE}
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
            teams={LEAGUE}
            onSelectTeam={goToTeam}
          />
        )}
      </main>
    </div>
  );
}
