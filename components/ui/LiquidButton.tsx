'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

// 'secondary' = verre neutre sans teinte (base `.liquid-btn` seule) — c'est le
// bouton par défaut du prototype (Google / Apple sur le login). Les autres
// variantes ajoutent un modificateur de teinte.
type LiquidButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface LiquidButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: LiquidButtonVariant
  children: ReactNode
}

// Structure obligatoire à 3 travées empilées (lb-bg / lb-shadow / content) —
// ne pas simplifier, c'est ce qui donne l'effet de verre liquide.
export default function LiquidButton({
  variant = 'primary',
  children,
  className = '',
  ...rest
}: LiquidButtonProps) {
  const variantClass = variant === 'secondary' ? '' : `liquid-btn-${variant}`
  return (
    <button
      className={`liquid-btn ${variantClass} ${className}`.trim().replace(/\s+/g, ' ')}
      {...rest}
    >
      <span className="lb-bg" />
      <span className="lb-shadow" />
      <span className="liquid-btn-content">{children}</span>
    </button>
  )
}
