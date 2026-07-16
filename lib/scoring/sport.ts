// Configuration de scoring d'un format « à points cible » (padel americano /
// mexicano et variantes futures). Volontairement SÉPARÉ de :
//   - lib/fft.ts     → barème officiel FFT du format élimination (Torneo)
//   - lib/bracket.ts → moteur d'élimination (paires fixes, progression bracket)
// qui restent 100 % dédiés au format à paires fixes.
//
// Objectif (task « généralisation ») : les règles de points vivent derrière une
// interface, pas en constantes en dur, pour qu'ajouter un sport/format soit
// « ajouter une config » plutôt que retoucher le moteur. Padel est la seule
// config qui existe pour l'instant.

/** Totaux de points par match proposés à la création (padel americano/mexicano). */
export const POINTS_PAR_MATCH_OPTIONS = [16, 20, 24, 32] as const
export type PointsParMatch = (typeof POINTS_PAR_MATCH_OPTIONS)[number]

/**
 * Comment les points d'un match se cumulent au classement. Axe laissé ouvert
 * pour la variante future « team americano » (cumul par paire) SANS la coder :
 * aujourd'hui seul 'individuel' existe.
 */
export type ModeCumul = 'individuel' // futur : | 'paire'

export interface SportScoringConfig {
  /** Identifiant technique. */
  id: string
  /** Libellé UI. */
  label: string
  /** Totaux de points par match sélectionnables (ex : [16, 20, 24, 32]). */
  pointsParMatchOptions: readonly number[]
  /** Total proposé par défaut. */
  pointsParMatchDefaut: number
  /** Mode d'agrégation du classement (individuel pour americano/mexicano). */
  modeCumul: ModeCumul
  /**
   * Points encaissés par un joueur de l'équipe ayant marqué `scoreEquipe`
   * (l'adversaire a marqué `scoreAdverse`) sur ce match. En americano/mexicano,
   * chaque joueur prend le score de SA propre équipe : 15-9 → 15 pour les deux
   * gagnants, 9 pour les deux perdants.
   */
  pointsJoueurPourMatch(scoreEquipe: number, scoreAdverse: number): number
  /**
   * Un match est terminé dès que la somme des deux scores atteint le total
   * cible : rally-point, l'égalité (12-12 sur 24) est acceptée, pas de 2 points
   * d'écart requis.
   */
  matchTermine(scoreEquipe: number, scoreAdverse: number, pointsParMatch: number): boolean
}

/**
 * Padel — americano ET mexicano partagent exactement les mêmes règles de
 * points ; seule la ROTATION/l'appariement diffère (logique du moteur, hors de
 * cette config de scoring).
 */
export const PADEL_SCORING: SportScoringConfig = {
  id: 'padel',
  label: 'Padel',
  pointsParMatchOptions: POINTS_PAR_MATCH_OPTIONS,
  pointsParMatchDefaut: 24,
  modeCumul: 'individuel',
  pointsJoueurPourMatch: (scoreEquipe) => scoreEquipe,
  matchTermine: (scoreEquipe, scoreAdverse, pointsParMatch) =>
    scoreEquipe + scoreAdverse >= pointsParMatch,
}
