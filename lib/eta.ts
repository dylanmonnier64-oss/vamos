import type { Match, Tournoi } from './supabase/database.types'
import { nextPowerOfTwo, nourriciersDe } from './bracket'

// ============================================================================
// Recalcul d'ETA. Le plan (terrain, creneau, moitie) est IMMUABLE ; seule
// l'heure estimée bouge, à partir de l'avancement réel. calculerETA est PURE
// (testable sans base) ; recalculerETA n'est qu'un wrapper qui persiste.
// ============================================================================

function ordre(a: Match, b: Match): number {
  return (
    (a.creneau ?? 0) - (b.creneau ?? 0) ||
    (a.tableau === b.tableau ? 0 : a.tableau === 'winners' ? -1 : 1) ||
    a.match_num - b.match_num
  )
}

/**
 * ETA de démarrage estimée de chaque match non démarré, à `maintenant`.
 * Règles :
 *  - Aucune ETA n'est antérieure à `maintenant`.
 *  - Un terrain portant un match en cours se libère à heure_debut + durée, ou à
 *    `maintenant` si ce moment est déjà passé (un match qui déborde ne produit
 *    jamais une ETA dans le passé).
 *  - Un match démarre au max entre la libération de SON terrain (fixe) et la
 *    fin estimée de ses DEUX nourriciers (contrainte de dépendance).
 *  - Byes ignorés.
 */
export function calculerETA(
  tournoi: Pick<Tournoi, 'duree_match_minutes' | 'nb_equipes'>,
  matchs: Match[],
  maintenant: Date
): Map<string, Date> {
  const duree = tournoi.duree_match_minutes * 60_000
  const now = maintenant.getTime()
  const total = nextPowerOfTwo(tournoi.nb_equipes ?? 2)

  const parRef = new Map<string, Match>()
  for (const m of matchs) parRef.set(`${m.tableau}:${m.tour}:${m.match_num}`, m)

  const finEstimee = new Map<string, number>() // matchId -> ms
  const libTerrain = new Map<number, number>() // terrain -> ms de libération

  // Matchs en cours : occupent leur terrain jusqu'à leur fin estimée (≥ now).
  for (const m of matchs) {
    if (m.statut === 'en_cours' && m.terrain != null) {
      const debut = m.heure_debut ? new Date(m.heure_debut).getTime() : now
      const fin = Math.max(debut + duree, now)
      libTerrain.set(m.terrain, Math.max(libTerrain.get(m.terrain) ?? now, fin))
      finEstimee.set(m.id, fin)
    }
  }
  // Matchs terminés : fin réelle connue (pour les dépendances).
  for (const m of matchs) {
    if (m.statut === 'termine') {
      finEstimee.set(m.id, m.heure_fin ? new Date(m.heure_fin).getTime() : now)
    }
  }

  const eta = new Map<string, Date>()
  const aPlanifier = matchs
    .filter(
      (m) =>
        (m.statut === 'en_attente' || m.statut === 'equipes_presentes') &&
        m.est_bye === false &&
        m.terrain != null
    )
    .sort(ordre)

  for (const m of aPlanifier) {
    let depFin = now
    for (const ref of nourriciersDe(m, total)) {
      const f = parRef.get(`${ref.tableau}:${ref.tour}:${ref.match_num}`)
      if (f) depFin = Math.max(depFin, finEstimee.get(f.id) ?? now)
    }
    const relTerrain = libTerrain.get(m.terrain!) ?? now
    const debut = Math.max(now, relTerrain, depFin)
    eta.set(m.id, new Date(debut))
    const fin = debut + duree
    finEstimee.set(m.id, fin)
    libTerrain.set(m.terrain!, fin)
  }

  return eta
}

/**
 * Wrapper DB : recalcule et persiste toutes les ETA. N'écrit JAMAIS terrain,
 * creneau ni moitie — seulement heure_convocation_estimee, via la RPC maj_eta
 * (SECURITY DEFINER, 0008). Un seul chemin d'écriture ETA, valable côté manager
 * (session RLS) COMME côté joueur anon (après un démarrage) : maj_eta est scopée
 * au tournoi et n'écrit que la colonne d'ETA.
 */
export async function recalculerETA(tournoiId: string): Promise<void> {
  const { createClient } = await import('./supabase/server')
  const supabase = await createClient()
  const [{ data: tournoi }, { data: matchs }] = await Promise.all([
    supabase.from('tournois').select('duree_match_minutes, nb_equipes').eq('id', tournoiId).single(),
    supabase.from('matchs').select('*').eq('tournoi_id', tournoiId),
  ])
  if (!tournoi || !matchs) return
  const eta = calculerETA(
    tournoi as Pick<Tournoi, 'duree_match_minutes' | 'nb_equipes'>,
    matchs as Match[],
    new Date()
  )
  const etas = [...eta.entries()].map(([id, d]) => ({ id, eta: d.toISOString() }))
  if (etas.length === 0) return
  await supabase.rpc('maj_eta', { p_tournoi_id: tournoiId, p_etas: etas })
}
