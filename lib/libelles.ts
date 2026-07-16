import { nourriciersDe, refNourricier, nbToursWinners } from './bracket'
import type { Match } from './supabase/database.types'

// ============================================================================
// Libellés d'affichage des slots inconnus (« Vainqueur T1 · créneau 2 »,
// « Perdant T3 », « Vainqueur demi-gauche »…). Le terrain étant IMMUABLE, ces
// libellés restent vrais toute la durée du tournoi. Partagé par /manager/live,
// /tableau/[id] et /t/[code]. PUR (aucun accès base).
// ============================================================================

export interface LibelleSlots {
  e1: string
  e2: string
}

/**
 * Pour chaque match, le libellé de chacun de ses deux slots — à afficher quand
 * l'équipe correspondante n'est pas encore connue. Les slots du tour 1 winners
 * (équipes connues d'emblée) renvoient 'À déterminer' (ne s'affiche pas en
 * pratique). Réutilise refNourricier/nourriciersDe : mêmes libellés que le plan.
 */
export function libellesFeeders(matchs: Match[], total: number): Map<string, LibelleSlots> {
  const nbTours = nbToursWinners(total)
  const terrainCounts = new Map<number, number>()
  for (const m of matchs) {
    if (m.terrain != null) terrainCounts.set(m.terrain, (terrainCounts.get(m.terrain) ?? 0) + 1)
  }
  const parClef = new Map(matchs.map((m) => [`${m.tableau}:${m.tour}:${m.match_num}`, m]))
  const ctx = { terrainCounts, nbTours }

  const out = new Map<string, LibelleSlots>()
  for (const m of matchs) {
    const refs = nourriciersDe(m, total) // [nourricier equipe1, nourricier equipe2]
    const libelle = (i: 0 | 1): string => {
      const ref = refs[i]
      if (!ref) return 'À déterminer'
      const f = parClef.get(`${ref.tableau}:${ref.tour}:${ref.match_num}`)
      if (!f || f.tableau == null || f.terrain == null || f.creneau == null) return 'À déterminer'
      // Consolante sous-tour 1 = nourri par des PERDANTS winners ; sinon vainqueurs.
      const type = m.tableau === 'consolante' && m.tour % 100 === 1 ? 'perdant' : 'gagnant'
      return refNourricier(
        { tableau: f.tableau, tour: f.tour, moitie: f.moitie },
        type,
        { creneau: f.creneau, terrain: f.terrain },
        ctx
      )
    }
    out.set(m.id, { e1: libelle(0), e2: libelle(1) })
  }
  return out
}
