import { describe, test, expect } from 'vitest'
import { calculerETA } from '../lib/eta'
import { nourriciersDe } from '../lib/bracket'
import { bracketInitial, HEURE } from './helpers'

const DUREE_MS = 45 * 60_000

describe('calculerETA', () => {
  test('aucune ETA antérieure à maintenant', () => {
    const { tournoi, matchs } = bracketInitial(16, 4)
    const maintenant = new Date(HEURE)
    const eta = calculerETA(tournoi, matchs, maintenant)
    for (const d of eta.values()) {
      expect(d.getTime()).toBeGreaterThanOrEqual(maintenant.getTime())
    }
  })

  test('un match ne démarre jamais avant la fin estimée de ses deux nourriciers', () => {
    const { tournoi, matchs } = bracketInitial(16, 4)
    const maintenant = new Date(HEURE)
    const eta = calculerETA(tournoi, matchs, maintenant)
    const parClef = new Map(matchs.map((m) => [`${m.tableau}:${m.tour}:${m.match_num}`, m]))
    for (const m of matchs) {
      if (m.est_bye) continue
      const monEta = eta.get(m.id)
      if (!monEta) continue
      for (const ref of nourriciersDe(m, 16)) {
        const f = parClef.get(`${ref.tableau}:${ref.tour}:${ref.match_num}`)
        if (!f || f.est_bye) continue
        const finFeeder = eta.get(f.id)
        if (finFeeder) {
          expect(monEta.getTime()).toBeGreaterThanOrEqual(finFeeder.getTime() + DUREE_MS)
        }
      }
    }
  })

  test('un match en cours occupe son terrain jusqu’à heure_debut + durée', () => {
    const { tournoi, matchs } = bracketInitial(8, 2)
    const maintenant = new Date(HEURE)
    // On force winners/1/1 en cours, démarré à maintenant, sur son terrain.
    const m1 = matchs.find((m) => m.tableau === 'winners' && m.tour === 1 && m.match_num === 1)!
    m1.statut = 'en_cours'
    m1.heure_debut = HEURE
    const terrain = m1.terrain
    const eta = calculerETA(tournoi, matchs, maintenant)
    // Tout autre match assigné à ce terrain démarre au plus tôt à la libération.
    const release = maintenant.getTime() + DUREE_MS
    for (const m of matchs) {
      if (m.id === m1.id || m.terrain !== terrain || m.est_bye) continue
      const e = eta.get(m.id)
      if (e) expect(e.getTime()).toBeGreaterThanOrEqual(release)
    }
  })
})
