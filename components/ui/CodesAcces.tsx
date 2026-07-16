'use client'

import { useState } from 'react'
import styles from './CodesAcces.module.css'

interface EquipeCode {
  id: string
  nom: string
  code_acces: string
}

// Composant partagé (élimination bracket + team americano planning) : liste les
// équipes/paires avec leur code d'accès + lien /t/[code] à communiquer
// manuellement. Le bouton copie l'URL absolue (origine réelle + /t/CODE).
export default function CodesAcces({ equipes }: { equipes: EquipeCode[] }) {
  const [copie, setCopie] = useState<string | null>(null)

  async function copier(code: string) {
    const url = `${window.location.origin}/t/${code}`
    let ok = false
    try {
      await navigator.clipboard.writeText(url)
      ok = true
    } catch {
      // Fallback pour les contextes où l'API async clipboard est bloquée
      // (document non focalisé, contexte non sécurisé) : textarea + execCommand.
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopie(code)
      setTimeout(() => setCopie((c) => (c === code ? null : c)), 1600)
    }
    // Si aucune méthode n'aboutit, le lien reste visible et sélectionnable.
  }

  return (
    <div className={styles.codesGrid}>
      {equipes.map((e) => (
        <div key={e.id} className={styles.codeRow}>
          <div className={styles.codeInfo}>
            <span className={styles.codeNom}>{e.nom}</span>
            <span className={styles.codeLien}>/t/{e.code_acces}</span>
          </div>
          <button
            type="button"
            className={`${styles.copyBtn} ${copie === e.code_acces ? styles.copyBtnDone : ''}`.trim()}
            onClick={() => copier(e.code_acces)}
          >
            {copie === e.code_acces ? 'Copié ✓' : 'Copier le lien'}
          </button>
        </div>
      ))}
    </div>
  )
}
