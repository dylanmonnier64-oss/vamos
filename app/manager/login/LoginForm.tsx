'use client'

import { useState, type CSSProperties } from 'react'
import LiquidButton from '@/components/ui/LiquidButton'
import { t } from '@/lib/i18n'
import { connexion } from './actions'

// ─── Icônes inline (design_handoff_vamos/login-variations.jsx) ──────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.61z" fill="#fff" opacity="0.95" />
      <path d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.59-5.05-3.71H.95v2.34A9 9 0 009 18z" fill="#fff" opacity="0.7" />
      <path d="M3.95 10.71A5.41 5.41 0 013.66 9c0-.59.1-1.17.29-1.71V4.95H.95A9 9 0 000 9c0 1.45.35 2.83.95 4.05l3-2.34z" fill="#fff" opacity="0.5" />
      <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A9 9 0 009 0 9 9 0 00.95 4.95l3 2.34C4.66 5.17 6.65 3.58 9 3.58z" fill="#fff" opacity="0.85" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="white" aria-hidden="true">
      <path d="M14.94 10.43c-.02-2.4 1.96-3.55 2.05-3.61-1.12-1.64-2.86-1.86-3.48-1.89-1.48-.15-2.89.87-3.64.87-.76 0-1.92-.85-3.16-.83-1.62.02-3.13.94-3.96 2.4-1.7 2.94-.43 7.29 1.21 9.67.8 1.16 1.75 2.47 2.99 2.42 1.2-.05 1.66-.78 3.11-.78s1.86.78 3.13.75c1.3-.02 2.11-1.18 2.9-2.36.91-1.35 1.29-2.66 1.31-2.73-.03-.01-2.52-.97-2.55-3.91zM12.5 3.13c.66-.8 1.1-1.91.98-3.02-.95.04-2.1.63-2.78 1.43-.61.7-1.14 1.83-1 2.92 1.06.08 2.14-.54 2.8-1.33z" />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M1.5 9C3 5.5 6 3.5 9 3.5s6 2 7.5 5.5c-1.5 3.5-4.5 5.5-7.5 5.5S3 12.5 1.5 9z" />
      <circle cx="9" cy="9" r="2.5" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2 2l14 14M6.5 6.5a2.5 2.5 0 003.4 3.4M3 9c1.3-3 4-5 6-5 1 0 2 .2 2.8.6m3.5 2.3c.7.6 1.3 1.3 1.7 2.1-1.5 3.5-4.5 5.5-7.5 5.5-.9 0-1.8-.2-2.5-.5" />
    </svg>
  )
}

// 3 points qui clignotent en cascade pendant le loading (vamosBlink).
function Dot({ delay }: { delay: number }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'white',
        display: 'inline-block',
        animation: 'vamosBlink 900ms infinite ease-in-out',
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

const eyeBtnStyle: CSSProperties = {
  position: 'absolute',
  right: 14,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-2)',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
}

export default function LoginForm() {
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Auth via Server Action `connexion` : la connexion + la pose du cookie +
  // le redirect se font côté serveur, dans le même aller-retour → pas de
  // course client/serveur avec le middleware. En cas de succès l'action
  // redirige (on ne repasse pas ici) ; en cas d'échec elle renvoie { error }.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !pw || loading) return
    setErreur(null)
    setLoading(true)

    const res = await connexion(email, pw)

    // On n'atteint cette ligne que si l'action a renvoyé une erreur (le succès
    // déclenche un redirect serveur qui navigue avant de revenir ici).
    if (res?.error) {
      setLoading(false)
      setErreur(res.error)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="field">
        <label className="field-label" htmlFor="login-email">{t('login.email')}</label>
        <input
          id="login-email"
          type="email"
          className="field-input"
          placeholder={t('login.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label className="field-label" htmlFor="login-pw">{t('login.motDePasse')}</label>
          <a href="#" className="text-link" style={{ fontSize: 12, borderBottom: 'none', color: 'var(--ink-2)' }}>
            {t('login.oublie')}
          </a>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            id="login-pw"
            type={showPw ? 'text' : 'password'}
            className="field-input"
            placeholder="••••••••••"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            aria-label={t('login.afficherMotDePasse')}
            style={eyeBtnStyle}
          >
            <EyeIcon open={showPw} />
          </button>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          className="check"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <span style={{ color: 'var(--ink-1)', fontSize: 13.5 }}>{t('login.seSouvenir')}</span>
      </label>

      <LiquidButton variant="primary" type="submit" style={{ width: '100%', marginTop: 4 }}>
        {loading ? (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <Dot delay={0} />
            <Dot delay={120} />
            <Dot delay={240} />
          </span>
        ) : done ? (
          t('login.succes')
        ) : (
          t('login.entrer')
        )}
      </LiquidButton>

      {erreur && (
        <p className="form-error" role="alert" style={{ margin: 0, textAlign: 'center' }}>
          {erreur}
        </p>
      )}

      <div className="divider">
        <span>{t('login.ouContinuer')}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <LiquidButton variant="secondary" type="button">
          <GoogleIcon /> Google
        </LiquidButton>
        <LiquidButton variant="secondary" type="button">
          <AppleIcon /> Apple
        </LiquidButton>
      </div>
    </form>
  )
}
