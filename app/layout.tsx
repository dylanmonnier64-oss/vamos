import type { Metadata } from 'next'
import BgAtmo from '@/components/ui/BgAtmo'
import LiquidGlassFilter from '@/components/ui/LiquidGlassFilter'
import './globals.css'

export const metadata: Metadata = {
  title: 'VAMOS — Gestion de tournois de padel',
  description: 'La plateforme qui organise vos tournois de padel en temps réel.',
}

// BgAtmo et LiquidGlassFilter sont posés ici une seule fois pour toute
// l'app (manager, tableau, joueur) — inutile de les répéter par page.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Boldonse&family=Big+Shoulders+Display:wght@400;600;800&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <BgAtmo />
        <LiquidGlassFilter />
        {children}
      </body>
    </html>
  )
}
