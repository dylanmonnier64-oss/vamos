import type { Match } from './supabase/database.types'

// ============================================================================
// Démarrage d'un match. Le terrain est FIXE (planifié par l'ordonnanceur) ; on
// ne fait que décider QUAND un match peut partir. Un match démarre dès que son
// terrain (le sien, pas un autre) est libre et ses deux équipes connues — le
// créneau ne bloque jamais.
// ============================================================================

/** Tri des démarrables : créneau croissant, winners avant consolante, match_num. */
function ordre(a: Match, b: Match): number {
  return (
    (a.creneau ?? 0) - (b.creneau ?? 0) ||
    (a.tableau === b.tableau ? 0 : a.tableau === 'winners' ? -1 : 1) ||
    a.match_num - b.match_num
  )
}

/**
 * Matchs démarrables (fonction PURE). Un match est démarrable ssi : statut
 * 'en_attente', pas un bye, ses deux équipes connues, et AUCUN match n'est
 * actuellement en_cours sur SON terrain. Le créneau n'entre pas dans la
 * condition. Trié pour que, terrain libre, le plus petit créneau démarrable
 * parte en premier — même si un créneau antérieur sur ce terrain n'est pas
 * encore prêt (une équipe inconnue) : on ne laisse jamais un terrain inactif.
 */
export function filtrerDemarrables(matchs: Match[]): Match[] {
  const terrainsOccupes = new Set<number>()
  for (const m of matchs) {
    if (m.statut === 'en_cours' && m.terrain != null) terrainsOccupes.add(m.terrain)
  }
  return matchs
    .filter(
      (m) =>
        m.statut === 'en_attente' &&
        m.est_bye === false &&
        m.equipe1_id != null &&
        m.equipe2_id != null &&
        m.terrain != null &&
        !terrainsOccupes.has(m.terrain)
    )
    .sort(ordre)
}

/** Les deux équipes sont physiquement présentes (prérequis de LANCEMENT). */
export function estPresent(m: Match): boolean {
  return m.equipe1_presente === true && m.equipe2_presente === true
}

/**
 * DEUX NOTIONS SÉPARÉES — POUR TOUJOURS. Ne jamais les fusionner, ne jamais
 * mettre la présence dans filtrerDemarrables :
 *  - `filtrerDemarrables` (DÉMARRABLE) : « ce match peut-il occuper le terrain
 *    maintenant » — statut en_attente, est_bye=false, 2 équipes connues, terrain
 *    libre. C'est de la PLANIFICATION. INCHANGÉE : la simulation en dépend.
 *  - `estLancable` / `filtrerLancables` (LANÇABLE) : démarrable ET les deux
 *    joueurs sont physiquement là (présence). C'est le VERROU de lancement.
 * Seul « lançable » active le bouton « Lancer » et autorise le passage en
 * en_cours. Un match ne démarre donc jamais avec une équipe absente (chrono dans
 * le vide + ETA faussées en aval). Le verrou est aussi appliqué côté SQL par la
 * RPC demarrer_match (migration 0010) — il ne repose pas sur l'UI.
 */
export function filtrerLancables(matchs: Match[]): Match[] {
  return filtrerDemarrables(matchs).filter(estPresent)
}

/** Un match précis est-il lançable maintenant (démarrable + deux présences) ? */
export function estLancable(m: Match, matchs: Match[]): boolean {
  return estPresent(m) && filtrerDemarrables(matchs).some((x) => x.id === m.id)
}

/** Wrapper DB : charge les matchs du tournoi et renvoie les démarrables. */
export async function matchsDemarrables(tournoiId: string): Promise<Match[]> {
  const { createClient } = await import('./supabase/server')
  const supabase = await createClient()
  const { data } = await supabase.from('matchs').select('*').eq('tournoi_id', tournoiId)
  return filtrerDemarrables((data ?? []) as Match[])
}
