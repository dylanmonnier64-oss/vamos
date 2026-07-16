import type { Metadata } from 'next'
import ScatteredWord from '@/components/ui/ScatteredWord'
import { t } from '@/lib/i18n'
import LoginForm from './LoginForm'

// Reproduction fidèle de design_handoff_vamos (LoginPistaFR).
// Le fond (photo + orbes + grain) et le filtre SVG liquid glass sont fournis
// globalement par app/layout.tsx (BgAtmo + LiquidGlassFilter). Seed = 7,
// chaos = 1 (valeurs réelles du prototype).

export const metadata: Metadata = {
  title: t('login.metaTitre'),
}

const SEED = 7
const CHAOS = 1

export default function LoginPage() {
  return (
    <div className="pista-stage">
      {/* Colonne gauche — wordmark + hero dispersé */}
      <section className="pista-left">
        <header className="pista-header">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
            <div className="wordmark" style={{ fontSize: 16, letterSpacing: '0.02em' }}>
              vamos
            </div>
            <div className="pista-tagline eyebrow">{t('login.tagline')}</div>
          </div>
        </header>

        <div className="pista-hero">
          <h1 className="pista-hero-title">
            <span style={{ display: 'block' }}>
              <ScatteredWord text="ALLEZ," seed={SEED} chaos={CHAOS} accentIndices={[5]} />
            </span>
            <span style={{ display: 'block' }}>
              <ScatteredWord
                text="ON JOUE."
                seed={SEED + 4}
                chaos={CHAOS * 1.1}
                color="var(--ink-2)"
                accent="oklch(0.68 0.16 55)"
                accentIndices={[7]}
              />
            </span>
          </h1>
        </div>
      </section>

      {/* Colonne droite — carte de connexion */}
      <section className="pista-right">
        <div className="glass pista-card">
          <div style={{ marginBottom: 26 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              {t('login.eyebrow')}
            </div>
            <h2 className="pista-card-title">{t('login.titre')}</h2>
            <p className="pista-card-sub">{t('login.sousTitre')}</p>
          </div>
          <LoginForm />
        </div>
      </section>
    </div>
  )
}
