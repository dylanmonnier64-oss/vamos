// ============================================================================
// Progression après un score — colle onScoreSaisi (logique TS, source de vérité)
// à la persistance. `construireMajDepuisScore` est PUR (pas de base) : il valide
// le score, appelle onScoreSaisi et emballe le diff. Deux consommateurs :
//   • le manager (session RLS) applique le diff en direct ;
//   • le joueur (anon) l'envoie à la RPC progresser_bracket (0008).
// Aucun des deux ne recalcule quoi que ce soit — la logique est dans bracket.ts.
// ============================================================================

import { onScoreSaisi, type ScoreSaisiResult } from './bracket'
import { parseScoreSets } from './score'
import type { Match, Tournoi } from './supabase/database.types'

/** Diff persistable — même forme pour l'applicateur manager et la RPC joueur. */
export interface MajProgression {
  /** Slots/gagnant/statut à écrire (jamais le terrain). */
  matchs: Array<Partial<Match> & { id: string }>
  /** Placements finaux. */
  equipes: Array<{ id: string; place_finale: number; points_fft: number | null }>
  tournoi_termine: boolean
}

export function construireMaj(resultat: ScoreSaisiResult): MajProgression {
  return {
    matchs: [resultat.matchMisAJour, ...resultat.matchsAMettreAJour],
    equipes: resultat.placementsFinaux.map((p) => ({
      id: p.id,
      place_finale: p.place_finale,
      points_fft: p.points_fft,
    })),
    tournoi_termine: resultat.tournoiTermine,
  }
}

export type MajResultat =
  | { erreur: string }
  | { maj: MajProgression; gagnantId: string; tournoiTermine: boolean }

/**
 * Valide le score et construit le diff de progression. PUR (aucun accès base) —
 * utilisable côté manager, côté joueur et dans les tests. `matchs` est l'état
 * complet du tournoi ; `matchId` le match dont on saisit le score.
 */
export function construireMajDepuisScore(
  matchs: Match[],
  tournoi: Pick<Tournoi, 'nb_equipes' | 'categorie_fft'>,
  matchId: string,
  s1: string,
  s2: string
): MajResultat {
  const match = matchs.find((m) => m.id === matchId)
  if (!match) return { erreur: 'Match introuvable' }
  if (match.equipe1_id == null || match.equipe2_id == null) {
    return { erreur: 'Les deux équipes ne sont pas connues.' }
  }

  const res = parseScoreSets(s1, s2)
  if (!res.valide) return { erreur: res.raison ?? 'Score invalide.' }

  // parseScoreSets est la SEULE source du vainqueur.
  const gagnantId = res.gagnant === 1 ? match.equipe1_id : match.equipe2_id

  const resultat = onScoreSaisi({
    match,
    scoreEquipe1: s1,
    scoreEquipe2: s2,
    gagnantId,
    tousLesMatchs: matchs,
    tournoi,
  })

  return { maj: construireMaj(resultat), gagnantId, tournoiTermine: resultat.tournoiTermine }
}
