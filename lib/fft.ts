import type { CategorieFft } from './supabase/database.types'

// ============================================================================
// Barème officiel FFT — Chapitre II "Classements, Barèmes & Assimilations",
// MAJ Février 2026, applicable depuis le 1er mars 2026 (réforme qui a
// remplacé l'ancien barème de juillet 2024, désormais obsolète).
// Source : document FFT réhébergé par les ligues régionales (identique sur
// padelmagazine.fr et liguenormandietennis.fr, vérifié sur les deux).
//
// ⚠️ P1000 MANQUANT — ne pas deviner ces valeurs. Dans le PDF source
// officiel, le tableau qui suit l'intitulé "LES BAREMES DES POINTS => P 1000"
// contient en réalité les valeurs du P1500 (vérifié : elles correspondent
// exactement à l'ancien barème P1500 de 2024, colonne pour colonne). C'est
// une erreur dans le document FFT lui-même, présente à l'identique sur les
// deux sources indépendantes consultées. Tant que ce n'est pas corrigé côté
// FFT ou confirmé autrement, getPoints() renvoie null pour P1000.
//
// P1500, P2000, P3000 sont inclus en bonus (extraits proprement, non
// demandés à l'origine) : utiles si VAMOS gère un jour des tournois de ce
// niveau, mais ces catégories n'étaient de toute façon pas concernées par
// la réforme du 1er mars 2026 (qui ne touche que P25 à P500).
//
// Règles générales FFT à respecter dans onScoreSaisi/bracket.ts :
// - Le nombre de paires *inscrites* (equipes.tournoi nb_equipes), pas la
//   taille du tableau complété par des byes, détermine la tranche à utiliser.
// - Ex-æquo : si un match de classement n'a pas lieu, les paires concernées
//   sont classées au même rang, le moins favorable, avec les mêmes points.
//   → C'est directement pertinent pour la limite documentée dans
//   estimerPlaceFinale() (lib/bracket.ts) : en fin de tableau consolante, la
//   bonne règle FFT est "même rang le moins favorable" plutôt que de deviner
//   un rang distinct.
// - Un match gagné sur le terrain est requis pour marquer plus que le
//   plancher de la dernière place (un WO donné ne compte pas comme victoire
//   pour ce calcul ; un WO reçu — l'adversaire déclare forfait — compte).
// ============================================================================

interface TrancheBareme {
  /** Borne haute du nombre de paires/équipes inscrites pour cette tranche. */
  maxEquipes: number
  /** place_finale -> points. Une place absente = n'existe pas pour cette taille de tableau. */
  points: Record<number, number>
}

const P25: TrancheBareme[] = [
  { maxEquipes: 8, points: { 1: 25, 2: 20, 3: 15, 4: 9, 5: 6, 6: 4, 7: 2, 8: 1 } },
  { maxEquipes: 12, points: { 1: 25, 2: 20, 3: 16, 4: 14, 5: 10, 6: 8, 7: 7, 8: 6, 9: 4, 10: 3, 11: 2, 12: 1 } },
  { maxEquipes: 16, points: { 1: 25, 2: 20, 3: 17, 4: 15, 5: 14, 6: 13, 7: 12, 8: 11, 9: 8, 10: 7, 11: 6, 12: 5, 13: 4, 14: 3, 15: 2, 16: 1 } },
  { maxEquipes: 20, points: { 1: 25, 2: 22, 3: 19, 4: 17, 5: 15, 6: 13, 7: 12, 8: 11, 9: 9, 10: 8, 11: 7, 12: 6, 13: 5, 14: 4, 15: 3, 16: 2, 17: 1, 18: 1, 19: 1, 20: 1 } },
  { maxEquipes: 24, points: { 1: 25, 2: 22, 3: 19, 4: 17, 5: 15, 6: 13, 7: 12, 8: 11, 9: 9, 10: 8, 11: 7, 12: 6, 13: 5, 14: 5, 15: 5, 16: 5, 17: 4, 18: 4, 19: 3, 20: 3, 21: 2, 22: 2, 23: 1, 24: 1 } },
  { maxEquipes: 28, points: { 1: 25, 2: 22, 3: 19, 4: 17, 5: 15, 6: 13, 7: 12, 8: 11, 9: 8, 10: 7, 11: 6, 12: 5, 13: 4, 14: 4, 15: 4, 16: 4, 17: 3, 18: 3, 19: 3, 20: 3, 21: 2, 22: 2, 23: 2, 24: 2, 25: 1, 26: 1, 27: 1, 28: 1 } },
]

const P50: TrancheBareme[] = [
  { maxEquipes: 8, points: { 1: 50, 2: 40, 3: 30, 4: 20, 5: 13, 6: 5, 7: 3, 8: 1 } },
  { maxEquipes: 12, points: { 1: 50, 2: 40, 3: 33, 4: 28, 5: 20, 6: 15, 7: 10, 8: 5, 9: 3, 10: 2, 11: 1, 12: 1 } },
  { maxEquipes: 16, points: { 1: 50, 2: 40, 3: 35, 4: 30, 5: 25, 6: 23, 7: 20, 8: 15, 9: 13, 10: 11, 11: 9, 12: 8, 13: 5, 14: 3, 15: 2, 16: 1 } },
  { maxEquipes: 20, points: { 1: 50, 2: 43, 3: 38, 4: 35, 5: 30, 6: 28, 7: 25, 8: 23, 9: 18, 10: 15, 11: 13, 12: 12, 13: 10, 14: 9, 15: 8, 16: 6, 17: 5, 18: 3, 19: 2, 20: 1 } },
  { maxEquipes: 24, points: { 1: 50, 2: 43, 3: 38, 4: 35, 5: 30, 6: 28, 7: 25, 8: 23, 9: 19, 10: 18, 11: 17, 12: 16, 13: 15, 14: 14, 15: 13, 16: 12, 17: 10, 18: 9, 19: 8, 20: 7, 21: 6, 22: 5, 23: 4, 24: 3 } },
  { maxEquipes: 28, points: { 1: 50, 2: 43, 3: 38, 4: 35, 5: 30, 6: 28, 7: 25, 8: 23, 9: 19, 10: 18, 11: 17, 12: 16, 13: 15, 14: 14, 15: 13, 16: 12, 17: 10, 18: 9, 19: 8, 20: 7, 21: 6, 22: 5, 23: 4, 24: 3, 25: 2, 26: 2, 27: 1, 28: 1 } },
  { maxEquipes: 32, points: { 1: 50, 2: 43, 3: 38, 4: 35, 5: 30, 6: 29, 7: 28, 8: 27, 9: 23, 10: 22, 11: 21, 12: 20, 13: 19, 14: 18, 15: 17, 16: 16, 17: 14, 18: 13, 19: 13, 20: 12, 21: 12, 22: 11, 23: 11, 24: 10, 25: 9, 26: 8, 27: 7, 28: 6, 29: 5, 30: 4, 31: 3, 32: 2 } },
]

const P100: TrancheBareme[] = [
  { maxEquipes: 8, points: { 1: 100, 2: 80, 3: 60, 4: 40, 5: 25, 6: 10, 7: 5, 8: 1 } },
  { maxEquipes: 12, points: { 1: 100, 2: 80, 3: 65, 4: 55, 5: 40, 6: 30, 7: 20, 8: 10, 9: 5, 10: 3, 11: 2, 12: 1 } },
  { maxEquipes: 16, points: { 1: 100, 2: 80, 3: 70, 4: 60, 5: 50, 6: 45, 7: 40, 8: 30, 9: 25, 10: 21, 11: 18, 12: 15, 13: 10, 14: 5, 15: 3, 16: 1 } },
  { maxEquipes: 20, points: { 1: 100, 2: 85, 3: 75, 4: 70, 5: 60, 6: 55, 7: 50, 8: 45, 9: 35, 10: 30, 11: 25, 12: 23, 13: 20, 14: 18, 15: 15, 16: 12, 17: 10, 18: 5, 19: 3, 20: 1 } },
  { maxEquipes: 24, points: { 1: 100, 2: 85, 3: 75, 4: 70, 5: 60, 6: 55, 7: 50, 8: 45, 9: 38, 10: 36, 11: 34, 12: 32, 13: 30, 14: 28, 15: 26, 16: 24, 17: 20, 18: 18, 19: 15, 20: 12, 21: 10, 22: 5, 23: 3, 24: 1 } },
  { maxEquipes: 28, points: { 1: 100, 2: 85, 3: 75, 4: 70, 5: 60, 6: 55, 7: 50, 8: 45, 9: 38, 10: 36, 11: 34, 12: 32, 13: 30, 14: 28, 15: 26, 16: 24, 17: 20, 18: 18, 19: 16, 20: 14, 21: 12, 22: 10, 23: 8, 24: 6, 25: 4, 26: 3, 27: 2, 28: 1 } },
  { maxEquipes: 32, points: { 1: 100, 2: 85, 3: 75, 4: 70, 5: 60, 6: 58, 7: 56, 8: 54, 9: 45, 10: 43, 11: 41, 12: 39, 13: 37, 14: 35, 15: 33, 16: 31, 17: 27, 18: 26, 19: 25, 20: 24, 21: 23, 22: 22, 23: 21, 24: 20, 25: 17, 26: 15, 27: 13, 28: 11, 29: 9, 30: 7, 31: 5, 32: 3 } },
]

const P250: TrancheBareme[] = [
  { maxEquipes: 8, points: { 1: 250, 2: 200, 3: 150, 4: 100, 5: 63, 6: 25, 7: 13, 8: 3 } },
  { maxEquipes: 12, points: { 1: 250, 2: 200, 3: 165, 4: 140, 5: 100, 6: 75, 7: 50, 8: 25, 9: 13, 10: 8, 11: 5, 12: 3 } },
  { maxEquipes: 16, points: { 1: 250, 2: 200, 3: 175, 4: 150, 5: 125, 6: 115, 7: 100, 8: 75, 9: 63, 10: 53, 11: 45, 12: 38, 13: 25, 14: 13, 15: 8, 16: 3 } },
  { maxEquipes: 20, points: { 1: 250, 2: 213, 3: 188, 4: 175, 5: 150, 6: 138, 7: 125, 8: 113, 9: 88, 10: 75, 11: 63, 12: 58, 13: 50, 14: 45, 15: 38, 16: 30, 17: 25, 18: 13, 19: 8, 20: 3 } },
  { maxEquipes: 24, points: { 1: 250, 2: 213, 3: 188, 4: 175, 5: 150, 6: 138, 7: 125, 8: 113, 9: 95, 10: 90, 11: 85, 12: 80, 13: 75, 14: 70, 15: 65, 16: 60, 17: 50, 18: 45, 19: 38, 20: 30, 21: 25, 22: 13, 23: 8, 24: 3 } },
  { maxEquipes: 28, points: { 1: 250, 2: 213, 3: 188, 4: 175, 5: 150, 6: 138, 7: 125, 8: 113, 9: 95, 10: 90, 11: 85, 12: 80, 13: 75, 14: 70, 15: 65, 16: 60, 17: 50, 18: 45, 19: 40, 20: 35, 21: 30, 22: 25, 23: 20, 24: 15, 25: 10, 26: 8, 27: 5, 28: 3 } },
  { maxEquipes: 32, points: { 1: 250, 2: 213, 3: 188, 4: 175, 5: 150, 6: 145, 7: 140, 8: 135, 9: 113, 10: 108, 11: 103, 12: 98, 13: 93, 14: 88, 15: 83, 16: 78, 17: 68, 18: 65, 19: 63, 20: 60, 21: 58, 22: 55, 23: 53, 24: 50, 25: 43, 26: 38, 27: 33, 28: 28, 29: 23, 30: 18, 31: 13, 32: 8 } },
]

const P500: TrancheBareme[] = [
  { maxEquipes: 8, points: { 1: 500, 2: 400, 3: 300, 4: 200, 5: 125, 6: 50, 7: 25, 8: 5 } },
  { maxEquipes: 12, points: { 1: 500, 2: 400, 3: 325, 4: 275, 5: 200, 6: 150, 7: 100, 8: 50, 9: 25, 10: 15, 11: 10, 12: 5 } },
  { maxEquipes: 16, points: { 1: 500, 2: 400, 3: 350, 4: 300, 5: 250, 6: 225, 7: 200, 8: 150, 9: 125, 10: 105, 11: 90, 12: 75, 13: 50, 14: 25, 15: 15, 16: 5 } },
  { maxEquipes: 20, points: { 1: 500, 2: 425, 3: 375, 4: 350, 5: 300, 6: 275, 7: 250, 8: 225, 9: 175, 10: 150, 11: 125, 12: 115, 13: 100, 14: 90, 15: 75, 16: 60, 17: 50, 18: 25, 19: 15, 20: 5 } },
  { maxEquipes: 24, points: { 1: 500, 2: 425, 3: 375, 4: 350, 5: 300, 6: 275, 7: 250, 8: 225, 9: 190, 10: 180, 11: 170, 12: 160, 13: 150, 14: 140, 15: 130, 16: 120, 17: 100, 18: 90, 19: 75, 20: 60, 21: 50, 22: 25, 23: 15, 24: 5 } },
  { maxEquipes: 28, points: { 1: 500, 2: 425, 3: 375, 4: 350, 5: 300, 6: 275, 7: 250, 8: 225, 9: 190, 10: 180, 11: 170, 12: 160, 13: 150, 14: 140, 15: 130, 16: 120, 17: 100, 18: 90, 19: 80, 20: 70, 21: 60, 22: 50, 23: 40, 24: 30, 25: 20, 26: 15, 27: 10, 28: 5 } },
  { maxEquipes: 32, points: { 1: 500, 2: 425, 3: 375, 4: 350, 5: 300, 6: 290, 7: 280, 8: 270, 9: 225, 10: 215, 11: 205, 12: 195, 13: 185, 14: 175, 15: 165, 16: 155, 17: 135, 18: 130, 19: 125, 20: 120, 21: 115, 22: 110, 23: 105, 24: 100, 25: 85, 26: 75, 27: 65, 28: 55, 29: 45, 30: 35, 31: 25, 32: 15 } },
]

// Bonus (non demandé, non touché par la réforme du 1/03/2026 — inclus pour
// référence future ; seulement 3 tranches dans le document officiel).
const P1500: TrancheBareme[] = [
  { maxEquipes: 24, points: { 1: 1500, 2: 1125, 3: 1050, 4: 975, 5: 900, 6: 825, 7: 750, 8: 705, 9: 645, 10: 600, 11: 555, 12: 495, 13: 450, 14: 420, 15: 375, 16: 345, 17: 300, 18: 270, 19: 225, 20: 180, 21: 150, 22: 75, 23: 45, 24: 15 } },
  { maxEquipes: 28, points: { 1: 1500, 2: 1200, 3: 1125, 4: 1050, 5: 975, 6: 900, 7: 825, 8: 795, 9: 750, 10: 720, 11: 675, 12: 645, 13: 600, 14: 570, 15: 525, 16: 495, 17: 450, 18: 420, 19: 375, 20: 345, 21: 300, 22: 270, 23: 225, 24: 180, 25: 150, 26: 75, 27: 45, 28: 15 } },
  { maxEquipes: 32, points: { 1: 1500, 2: 1200, 3: 1125, 4: 1080, 5: 1050, 6: 975, 7: 945, 8: 900, 9: 870, 10: 825, 11: 795, 12: 750, 13: 720, 14: 675, 15: 645, 16: 600, 17: 570, 18: 525, 19: 495, 20: 450, 21: 420, 22: 375, 23: 345, 24: 300, 25: 270, 26: 225, 27: 180, 28: 150, 29: 120, 30: 75, 31: 45, 32: 15 } },
]

const P2000: TrancheBareme[] = [
  { maxEquipes: 24, points: { 1: 2000, 2: 1500, 3: 1400, 4: 1300, 5: 1200, 6: 1100, 7: 1000, 8: 940, 9: 860, 10: 800, 11: 740, 12: 660, 13: 600, 14: 560, 15: 500, 16: 460, 17: 400, 18: 360, 19: 300, 20: 240, 21: 200, 22: 100, 23: 60, 24: 20 } },
  { maxEquipes: 28, points: { 1: 2000, 2: 1600, 3: 1500, 4: 1400, 5: 1300, 6: 1200, 7: 1100, 8: 1060, 9: 1000, 10: 960, 11: 900, 12: 860, 13: 800, 14: 760, 15: 700, 16: 660, 17: 600, 18: 560, 19: 500, 20: 460, 21: 400, 22: 360, 23: 300, 24: 240, 25: 200, 26: 100, 27: 60, 28: 20 } },
  { maxEquipes: 32, points: { 1: 2000, 2: 1600, 3: 1500, 4: 1440, 5: 1400, 6: 1300, 7: 1260, 8: 1200, 9: 1160, 10: 1100, 11: 1060, 12: 1000, 13: 960, 14: 900, 15: 860, 16: 800, 17: 760, 18: 700, 19: 660, 20: 600, 21: 560, 22: 500, 23: 460, 24: 400, 25: 360, 26: 300, 27: 240, 28: 200, 29: 160, 30: 100, 31: 60, 32: 20 } },
]

// P3000 : championnats de France Seniors par paires. Places par palier de 2
// (ex-æquo systématique entre rangs pairs/impairs — dernier match du
// dimanche non disputé par décision FFT, cf. document source).
const P3000_PALIERS: Record<number, number> = {
  1: 3000, 2: 2400, 3: 2160, 5: 1770, 7: 1590, 9: 1320, 11: 1200, 13: 1080,
  15: 960, 17: 810, 19: 750, 21: 690, 23: 630, 25: 480, 27: 420, 29: 360, 31: 315,
}

const BAREMES: Partial<Record<CategorieFft, TrancheBareme[]>> = {
  P25, P50, P100, P250, P500, P1500,
  // P1000 volontairement absent — cf. avertissement en tête de fichier.
}

/**
 * Points FFT pour une place donnée. `nbEquipes` = nombre de paires/équipes
 * réellement inscrites au tournoi (pas la taille du tableau complétée par
 * des byes — cf. tournois.nb_equipes).
 *
 * Renvoie null si :
 * - la catégorie n'a pas de barème saisi (P1000, voir avertissement),
 * - ou la place n'existe pas pour ce nombre d'équipes (ex: place 20 dans un
 *   tableau à 8 équipes).
 */
export function getPoints(
  categorie: CategorieFft,
  nbEquipes: number,
  placeFinale: number
): number | null {
  const tranches = BAREMES[categorie]
  if (!tranches) return null

  // Prend la première tranche dont la borne haute couvre nbEquipes ; si
  // nbEquipes dépasse la plus grande tranche définie, retombe sur la
  // dernière (comportement "ou plus" pour P50/P100/P250/P500 ; P25 n'a pas
  // de tranche "et plus" officielle au-delà de 28, donc ce fallback est une
  // extrapolation à valider si un P25 dépasse 28 équipes en pratique).
  const tranche = tranches.find((t) => nbEquipes <= t.maxEquipes) ?? tranches[tranches.length - 1]
  return tranche.points[placeFinale] ?? null
}

/**
 * Fourchette de points « indicatifs » pour l'espace joueur, à partir du libellé
 * `places_en_jeu` d'un match (ex. "Places 1-8"). Renvoie { min, max } sur toutes
 * les places réellement chiffrées de l'intervalle, ou NULL si aucune ne l'est
 * (P1000 — cf. avertissement — ou places hors barème). NULL ⇒ le bloc doit être
 * masqué (jamais afficher « null points »).
 */
export function fourchettePoints(
  placesEnJeu: string | null,
  categorie: CategorieFft,
  nbEquipes: number
): { min: number; max: number } | null {
  if (!placesEnJeu) return null
  const m = /(\d+)\s*-\s*(\d+)/.exec(placesEnJeu)
  if (!m) return null
  const a = Math.min(Number(m[1]), Number(m[2]))
  const b = Math.max(Number(m[1]), Number(m[2]))
  const pts: number[] = []
  for (let p = a; p <= b; p++) {
    const v = getPoints(categorie, nbEquipes, p)
    if (v != null) pts.push(v)
  }
  if (pts.length === 0) return null
  return { min: Math.min(...pts), max: Math.max(...pts) }
}

/** Cas particulier P3000 (paliers de 2 places, cf. structure du document officiel). */
export function getPointsP3000(placeFinale: number): number | null {
  if (placeFinale in P3000_PALIERS) return P3000_PALIERS[placeFinale]
  // Rang pair : ex-æquo avec le rang impair juste au-dessus (même tranche).
  if (placeFinale in P3000_PALIERS === false && placeFinale - 1 in P3000_PALIERS) {
    return P3000_PALIERS[placeFinale - 1]
  }
  return null
}
