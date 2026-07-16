// Fond atmosphérique VAMOS — reconstruit à l'identique du composant `Atmosphere`
// de design_handoff_vamos/login-variations.jsx (source de vérité DA).
// Photo `da-background.png` en fond de scène (via .bg-stage dans globals.css)
// + 3 orbes doux (prune / vert / cuivre) en `mix-blend-mode: screen` + grain
// SVG. Posé une seule fois via app/layout.tsx (position: fixed, z-index
// négatif) → actif sur les 3 espaces sans rien à faire dans les pages.
//
// intensity = 0.55 : valeur réelle configurée dans le prototype
// (TWEAK_DEFAULTS de « Vamos Login.html »), pas le défaut 0.7 du composant.
const INTENSITY = 0.55

export default function BgAtmo() {
  const i = INTENSITY
  return (
    <>
      <div className="bg-stage" />
      <div
        className="violet-orb"
        style={{
          width: '60vw',
          height: '60vw',
          left: '-12vw',
          top: '-15vh',
          background: `radial-gradient(circle, oklch(0.32 0.12 350 / ${0.22 * i}), transparent 60%)`,
        }}
      />
      <div
        className="violet-orb"
        style={{
          width: '40vw',
          height: '40vw',
          left: '8vw',
          bottom: '-18vh',
          background: `radial-gradient(circle, oklch(0.32 0.05 140 / ${0.18 * i}), transparent 60%)`,
        }}
      />
      <div
        className="violet-orb"
        style={{
          width: '32vw',
          height: '32vw',
          right: '-6vw',
          top: '20vh',
          background: `radial-gradient(circle, oklch(0.55 0.18 55 / ${0.18 * i}), transparent 60%)`,
        }}
      />
      <div className="bg-noise" />
    </>
  )
}
