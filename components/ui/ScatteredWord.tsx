// Wordmark dispersé — reconstruit à l'identique du composant `ScatteredWord`
// de design_handoff_vamos/login-variations.jsx (source de vérité DA).
//
// Chaque lettre reçoit une position statique déterministe (PRNG mulberry32
// seedé → même dispersion à chaque render, donc SSR-safe, aucun mismatch
// d'hydratation) : rot ±40°×chaos, dy ±12px×chaos, dx ±7px×chaos,
// scale 0.91–1.09×chaos, transform-origin 50% 70%.
//
// L'animation `vamosFloat` (globals.css) ne touche QUE `filter: brightness`
// — elle n'écrase donc pas le `transform` inline. Un seul <span> par lettre
// suffit (contrairement à l'ancienne version translateY qui imposait deux
// spans imbriqués).

interface ScatteredWordProps {
  text: string
  seed?: number
  chaos?: number
  color?: string
  accent?: string
  accentIndices?: number[]
  className?: string
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function ScatteredWord({
  text,
  seed = 1,
  chaos = 1,
  color = 'var(--ink-0)',
  accent = 'oklch(0.72 0.16 55)',
  accentIndices = [],
  className = '',
}: ScatteredWordProps) {
  const r = mulberry32(seed)
  const rand = text.split('').map(() => ({
    rot: (r() - 0.5) * 80 * chaos, // ±40°
    dy: (r() - 0.5) * 24 * chaos, // ±12px
    dx: (r() - 0.5) * 14 * chaos, // ±7px
    scale: 1 + (r() - 0.5) * 0.18 * chaos, // 0.91–1.09
  }))

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', flexWrap: 'wrap' }}
      aria-label={text}
      role="text"
    >
      {text.split('').map((ch, i) => {
        if (ch === ' ') {
          return (
            <span key={i} aria-hidden="true" style={{ width: '0.35em', display: 'inline-block' }} />
          )
        }
        const p = rand[i]
        const isAccent = accentIndices.includes(i)
        return (
          <span
            key={i}
            aria-hidden="true"
            className="scatter-letter"
            style={{
              display: 'inline-block',
              transform: `translate(${p.dx}px, ${p.dy}px) rotate(${p.rot}deg) scale(${p.scale})`,
              transformOrigin: '50% 70%',
              color: isAccent ? accent : color,
              animation: `vamosFloat ${4 + (i % 5) * 0.4}s ease-in-out ${i * 0.08}s infinite alternate`,
            }}
          >
            {ch}
          </span>
        )
      })}
    </span>
  )
}
