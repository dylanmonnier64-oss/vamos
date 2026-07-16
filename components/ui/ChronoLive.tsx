'use client'

import { useEffect, useRef } from 'react'

interface ChronoLiveProps {
  /** Date ISO de début du match (match.heure_debut) */
  startTime: string
  className?: string
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Écrit directement dans le DOM via ref plutôt que useState + re-render :
// sur /manager/live et /tableau/[id], plusieurs chronos tournent en même
// temps sur le même écran — un re-render React par seconde et par terrain
// devient coûteux. Conforme à la règle de dev du brief.
export default function ChronoLive({ startTime, className = '' }: ChronoLiveProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const start = new Date(startTime).getTime()

    const tick = () => {
      if (ref.current) {
        ref.current.textContent = formatElapsed(Date.now() - start)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return (
    <span ref={ref} className={`chrono-live ${className}`.trim()}>
      00:00
    </span>
  )
}
