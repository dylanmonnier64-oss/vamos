interface LiveDotProps {
  className?: string
}

// Point vert pulsé — indicateur de match en cours / connexion realtime active.
export default function LiveDot({ className = '' }: LiveDotProps) {
  return <span className={`live-dot ${className}`.trim()} aria-hidden="true" />
}
