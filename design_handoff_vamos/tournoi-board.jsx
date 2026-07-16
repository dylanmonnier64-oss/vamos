/* global React */

// ─── Data — tournament schedule (4 time slots × 4 courts) ─────────────────
const TOURNAMENT = {
  title: "VAMOS TOURNOI",
  slots: [
  { time: "10h00", label: "4 terrains", state: "live",
    matches: [
    { court: 1, status: "En cours" },
    { court: 2, status: "Fin de poule" },
    { court: 3, status: "En cours" },
    { court: 4, status: "Fin de poule" }]

  },
  { time: "11h15", label: "4 terrains", state: "next",
    matches: [
    { court: 1, status: "Fin de poule" },
    { court: 2, status: "Fin de poule" },
    { court: 3, status: "Fin de poule" },
    { court: 4, status: "Fin de poule" }]

  },
  { time: "12h30", label: "4 terrains", state: "later",
    matches: [
    { court: 1, status: "Quart de finale" },
    { court: 2, status: "Quart de finale" },
    { court: 3, status: "Quart de finale" },
    { court: 4, status: "Quart de finale" }]

  },
  { time: "14h00", label: "4 terrains", state: "later",
    matches: [
    { court: 1, status: "Demi-finale" },
    { court: 2, status: "Demi-finale" },
    { court: 3, status: "Demi-finale" },
    { court: 4, status: "Demi-finale" }]

  }]

};

// ─── Liquid Glass primitive (reused from login) ───────────────────────────
function LiquidPill({ tone = "default", children }) {
  // tone: 'default' | 'live' | 'next' | 'status' | 'status-accent'
  return (
    <span className={`lpill lpill-${tone}`}>
      <span className="lpill-bg" />
      <span className="lpill-shadow" />
      <span className="lpill-content">{children}</span>
    </span>);

}

function LiquidGlassFilter() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        <filter id="liquid-glass-filter" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05 0.05" numOctaves="1" seed="1" result="turbulence" />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap in="SourceGraphic" in2="blurredNoise" scale="70" xChannelSelector="R" yChannelSelector="B" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
        </filter>
      </defs>
    </svg>);

}

// ─── Components ───────────────────────────────────────────────────────────
function MatchRow({ m, live }) {
  return (
    <div className={`match ${live ? "match-live" : ""}`}>
      <div className="match-court">
        <span className="court-label">Terrain {m.court}</span>
        <LiquidPill tone={live ? "status-accent" : "status"}>{m.status}</LiquidPill>
      </div>
      <div className="match-teams">
        <div className="team-empty" />
        <div className="team-empty" />
      </div>
      {live && <span className="live-dot" aria-hidden />}
    </div>);

}

function SlotPanel({ slot }) {
  const live = slot.state === "live";
  return (
    <section className={`slot ${live ? "slot-live" : ""}`}>
      <header className="slot-head">
        <div className="slot-time">
          <span className="slot-time-h">{slot.time}</span>
          <span className="slot-time-meta">{slot.label}</span>
        </div>
        {live &&
        <LiquidPill tone="live">
            <span className="live-dot live-dot-flag" /> EN DIRECT
          </LiquidPill>
        }
        {slot.state === "next" && <LiquidPill tone="next">À SUIVRE</LiquidPill>}
      </header>
      <div className="slot-body">
        {slot.matches.map((m) => <MatchRow key={m.court} m={m} live={live} />)}
      </div>
    </section>);

}

function BoardClock() {
  const [time, setTime] = React.useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  React.useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    };
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="board-clock">
      <span className="board-clock-time" style={{ fontSize: "26px" }}>{time}</span>
    </div>);

}

function TournoiBoard() {
  return (
    <div className="board-stage">
      <LiquidGlassFilter />
      {/* atmospheric backdrop reused from login */}
      <div className="bg-stage" />
      <div className="violet-orb" style={{ width: "60vw", height: "60vw", left: "-12vw", top: "-15vh", background: "radial-gradient(circle, oklch(0.32 0.12 350 / 0.15), transparent 60%)" }} />
      <div className="violet-orb" style={{ width: "40vw", height: "40vw", left: "8vw", bottom: "-18vh", background: "radial-gradient(circle, oklch(0.32 0.05 140 / 0.14), transparent 60%)" }} />
      <div className="violet-orb" style={{ width: "32vw", height: "32vw", right: "-6vw", top: "20vh", background: "radial-gradient(circle, oklch(0.55 0.18 55 / 0.12), transparent 60%)" }} />
      <div className="bg-noise" />

      <header className="board-header">
        <h1 className="board-title">
          <span>vamos</span><span className="board-title-accent">tournoi</span>
        </h1>
        <BoardClock />
      </header>

      <div className="board-grid" style={{ opacity: "1" }}>
        {TOURNAMENT.slots.map((s, i) => <SlotPanel key={i} slot={s} />)}
      </div>
    </div>);

}

Object.assign(window, { TournoiBoard });