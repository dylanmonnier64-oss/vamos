/* global React */
const { useState, useMemo } = React;

// ─── Shared icons ─────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.61z" fill="#fff" opacity="0.95" />
      <path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.59-5.05-3.71H.95v2.34A9 9 0 009 18z" fill="#fff" opacity="0.7" />
      <path d="M3.95 10.71A5.41 5.41 0 013.66 9c0-.59.1-1.17.29-1.71V4.95H.95A9 9 0 000 9c0 1.45.35 2.83.95 4.05l3-2.34z" fill="#fff" opacity="0.5" />
      <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A9 9 0 009 0 9 9 0 00.95 4.95l3 2.34C4.66 5.17 6.65 3.58 9 3.58z" fill="#fff" opacity="0.85" />
    </svg>);

}
function AppleIcon() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="white" aria-hidden>
      <path d="M14.94 10.43c-.02-2.4 1.96-3.55 2.05-3.61-1.12-1.64-2.86-1.86-3.48-1.89-1.48-.15-2.89.87-3.64.87-.76 0-1.92-.85-3.16-.83-1.62.02-3.13.94-3.96 2.4-1.7 2.94-.43 7.29 1.21 9.67.8 1.16 1.75 2.47 2.99 2.42 1.2-.05 1.66-.78 3.11-.78s1.86.78 3.13.75c1.3-.02 2.11-1.18 2.9-2.36.91-1.35 1.29-2.66 1.31-2.73-.03-.01-2.52-.97-2.55-3.91zM12.5 3.13c.66-.8 1.1-1.91.98-3.02-.95.04-2.1.63-2.78 1.43-.61.7-1.14 1.83-1 2.92 1.06.08 2.14-.54 2.8-1.33z" />
    </svg>);

}
function EyeIcon({ open }) {
  return open ?
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1.5 9C3 5.5 6 3.5 9 3.5s6 2 7.5 5.5c-1.5 3.5-4.5 5.5-7.5 5.5S3 12.5 1.5 9z" />
      <circle cx="9" cy="9" r="2.5" />
    </svg> :

  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 2l14 14M6.5 6.5a2.5 2.5 0 003.4 3.4M3 9c1.3-3 4-5 6-5 1 0 2 .2 2.8.6m3.5 2.3c.7.6 1.3 1.3 1.7 2.1-1.5 3.5-4.5 5.5-7.5 5.5-.9 0-1.8-.2-2.5-.5" />
    </svg>;

}

// ─── Atmospheric backdrop ─────────────────────────────────────────────────
function Atmosphere({ intensity = 0.7 }) {
  const i = intensity;
  return (
    <>
      <div className="bg-stage" />
      <div className="violet-orb" style={{ width: "60vw", height: "60vw", left: "-12vw", top: "-15vh", background: `radial-gradient(circle, oklch(0.32 0.12 350 / ${0.22 * i}), transparent 60%)` }} />
      <div className="violet-orb" style={{ width: "40vw", height: "40vw", left: "8vw", bottom: "-18vh", background: `radial-gradient(circle, oklch(0.32 0.05 140 / ${0.18 * i}), transparent 60%)` }} />
      <div className="violet-orb" style={{ width: "32vw", height: "32vw", right: "-6vw", top: "20vh", background: `radial-gradient(circle, oklch(0.55 0.18 55 / ${0.18 * i}), transparent 60%)` }} />
      <div className="bg-noise" />
    </>);

}

// ─── Scattered letters ────────────────────────────────────────────────────
// Each character gets a deterministic but chaotic rotation + offset.
// Seed-based so it stays consistent across renders.
function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function ScatteredWord({ text, seed = 1, chaos = 1, color = "var(--ink-0)", accent = "oklch(0.72 0.16 55)", accentIndices = [] }) {
  const rand = useMemo(() => {
    const r = mulberry32(seed);
    return text.split("").map(() => ({
      rot: (r() - 0.5) * 80 * chaos, // ±40deg
      dy: (r() - 0.5) * 24 * chaos, // ±12px vertical jitter
      dx: (r() - 0.5) * 14 * chaos, // ±7px horizontal jitter
      scale: 1 + (r() - 0.5) * 0.18 * chaos // 0.91–1.09
    }));
  }, [text, seed, chaos]);

  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap" }}>
      {text.split("").map((ch, i) => {
        if (ch === " ") return <span key={i} style={{ width: "0.35em", display: "inline-block" }} />;
        const r = rand[i];
        const isAccent = accentIndices.includes(i);
        return (
          <span
            key={i}
            className="scatter-letter"
            style={{
              display: "inline-block",
              transform: `translate(${r.dx}px, ${r.dy}px) rotate(${r.rot}deg) scale(${r.scale})`,
              transformOrigin: "50% 70%",
              color: isAccent ? accent : color,
              animation: `vamosFloat ${4 + i % 5 * 0.4}s ease-in-out ${i * 0.08}s infinite alternate`
            }}>
            
            {ch}
          </span>);

      })}
    </span>);

}

// ─── Login form ───────────────────────────────────────────────────────────
function LoginForm() {
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!email || !pw) return;
    setLoading(true);
    setTimeout(() => {setLoading(false);setDone(true);setTimeout(() => setDone(false), 1800);}, 1100);
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="field">
        <label className="field-label">E-mail</label>
        <input
          type="email"
          className="field-input"
          placeholder="toi@vamos.club"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" />
        
      </div>

      <div className="field">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label className="field-label">Mot de passe</label>
          <a href="#" className="text-link" style={{ fontSize: 12, borderBottom: "none", color: "var(--ink-2)" }}>Oublié ?</a>
        </div>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            className="field-input"
            placeholder="••••••••••"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            style={{ paddingRight: 44 }} />
          
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            aria-label="Afficher / masquer le mot de passe"
            style={{
              position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", color: "var(--ink-2)", cursor: "pointer", padding: 4,
              display: "flex", alignItems: "center"
            }}>
            
            <EyeIcon open={showPw} />
          </button>
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
        <input type="checkbox" className="check" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span style={{ color: "var(--ink-1)", fontSize: 13.5 }}>Se souvenir de moi</span>
      </label>

      <LiquidBtn primary type="submit" style={{ width: "100%", marginTop: 4 }}>
        {loading ?
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Dot delay={0} /><Dot delay={120} /><Dot delay={240} />
          </span> :
        done ? "¡Vamos! ✓" : "Entrer sur le terrain →"}
      </LiquidBtn>

      <div className="divider"><span>Ou continue avec</span></div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <LiquidBtn><GoogleIcon /> Google</LiquidBtn>
        <LiquidBtn><AppleIcon /> Apple</LiquidBtn>
      </div>
    </form>);

}

// ─── Liquid Glass button ──────────────────────────────────────────────────
// SVG turbulence + displacement map → genuine refractive glass on the backdrop.
function LiquidBtn({ primary, type = "button", children, style, className = "", ...rest }) {
  return (
    <button
      type={type}
      {...rest}
      className={`liquid-btn ${primary ? "liquid-btn-primary" : ""} ${className}`.trim()}
      style={style}
    >
      <span className="lb-bg" />
      <span className="lb-shadow" />
      <span className="liquid-btn-content">{children}</span>
    </button>
  );
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
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

function Dot({ delay }) {
  return (
    <span
      style={{
        width: 6, height: 6, borderRadius: "50%", background: "white", display: "inline-block",
        animation: "vamosBlink 900ms infinite ease-in-out", animationDelay: `${delay}ms`
      }} />);


}

function Metric({ label, value, pulse }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="mono" style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</span>
      <span className="wordmark" style={{ fontSize: 30, color: pulse ? "oklch(0.72 0.16 55)" : "var(--ink-0)", textShadow: pulse ? "0 0 16px oklch(0.6 0.18 55 / 0.55)" : "none" }}>
        {value}
      </span>
    </div>);

}

// ─── V2 · PISTA — full bleed, FR, scattered letters ───────────────────────
function LoginPistaFR({ intensity = 0.7, chaos = 1, seed = 7 }) {
  return (
    <div className="pista-stage">
      <LiquidGlassFilter />
      <Atmosphere intensity={intensity} />

      {/* LEFT panel */}
      <section className="pista-left" data-screen-label="01 Login · gauche">
        <header className="pista-header">
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
            <div className="wordmark" style={{ fontSize: 16, letterSpacing: "0.02em" }}>vamos</div>
            <div className="pista-tagline eyebrow">· Bon retour sur le terrain ·</div>
          </div>
        </header>

        <div className="pista-hero">
          <h1 className="pista-hero-title">
            <span style={{ display: "block" }}>
              <ScatteredWord text="ALLEZ," seed={seed} chaos={chaos} accentIndices={[5]} />
            </span>
            <span style={{ display: "block" }}>
              <ScatteredWord text="ON JOUE." seed={seed + 4} chaos={chaos * 1.1} color="var(--ink-2)" accent="oklch(0.68 0.16 55)" accentIndices={[7]} />
            </span>
          </h1>
        </div>
      </section>

      {/* RIGHT panel — login card */}
      <section className="pista-right" data-screen-label="01 Login · droite">
        <div className="glass pista-card">
          <div style={{ marginBottom: 26 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Connexion</div>
            <h2 className="pista-card-title">Ton terrain, ton match.</h2>
            <p className="pista-card-sub">Entre tes identifiants ou continue avec un fournisseur.</p>
          </div>
          <LoginForm />
        </div>
      </section>
    </div>);

}

Object.assign(window, { LoginPistaFR, LiquidBtn, LiquidGlassFilter });