// ============================================================================
// Score d'un match d'élimination : UN SEUL SET à 9 jeux (format VAMOS).
// Exemple : « 9-3 ». Ce n'est PAS du best-of-3 sets. Source de vérité UNIQUE
// pour déterminer le vainqueur : aucun autre endroit du code ne déduit le
// gagnant. `parseScoreSets` est PURE (testable sans base).
//
// Stockage : deux colonnes `matchs.score_equipe1` / `score_equipe2`, chacune =
// les jeux GAGNÉS PAR CETTE ÉQUIPE dans le set. Pour un 9-3 côté équipe 1 :
// score_equipe1 = "9", score_equipe2 = "3". L'affichage « 9-3 » se reconstruit
// via formatScoreSets. `jeuxCible` (9 par défaut) est paramétrable pour pouvoir
// un jour gérer d'autres longueurs de set sans toucher aux appelants.
//
// Les points cible (team americano) vivent ailleurs
// (score_equipe1_points / score_equipe2_points) et ne concernent PAS ce module.
// ============================================================================

const JEUX_CIBLE_DEFAUT = 9

export interface ResultatScore {
  valide: boolean
  /** Motif de rejet (présent uniquement si !valide). */
  raison?: string
  /** Équipe gagnante : 1 = equipe1, 2 = equipe2 (présent uniquement si valide). */
  gagnant?: 1 | 2
  jeuxEquipe1?: number
  jeuxEquipe2?: number
}

/** Découpe une chaîne "9" en [9]. Rejette tout ce qui n'est pas un entier ≥ 0. */
function parseJeux(s: string): number[] | null {
  const brut = s.trim()
  if (brut === '') return null
  const parts = brut.split(/\s+/)
  const jeux: number[] = []
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null // pas un entier non signé
    jeux.push(Number(p))
  }
  return jeux
}

/**
 * Valide un score (UN set à `jeuxCible` jeux) et détermine le vainqueur.
 * @param s1 jeux de l'équipe 1 — ex. "9"
 * @param s2 jeux de l'équipe 2 — ex. "3"
 *
 * Rejette : format non entier, plus d'un set (« 6-4 6-3 » n'a pas lieu d'être),
 * égalité (pas de vainqueur), set incomplet (le vainqueur n'atteint pas `jeuxCible`).
 */
export function parseScoreSets(s1: string, s2: string, jeuxCible = JEUX_CIBLE_DEFAUT): ResultatScore {
  const j1 = parseJeux(s1)
  const j2 = parseJeux(s2)
  if (j1 === null || j2 === null) {
    return { valide: false, raison: 'Format de score invalide (attendu deux entiers, ex. « 9 3 »).' }
  }
  if (j1.length !== 1 || j2.length !== 1) {
    return { valide: false, raison: 'Un seul set attendu (ex. 9-3).' }
  }
  const a = j1[0]
  const b = j2[0]
  if (a === b) {
    return { valide: false, raison: `Pas de vainqueur (${a}-${b}).` }
  }
  if (Math.max(a, b) < jeuxCible) {
    return { valide: false, raison: `Set incomplet : le vainqueur doit atteindre ${jeuxCible} jeux.` }
  }
  return { valide: true, gagnant: a > b ? 1 : 2, jeuxEquipe1: a, jeuxEquipe2: b }
}

/**
 * Parse une saisie « 9-3 » (un set, « a-b ») en deux colonnes par équipe
 * { s1: "9", s2: "3" }. Renvoie null si le format est invalide. La validation
 * padel (vainqueur, set complet…) reste à parseScoreSets.
 */
export function parseSaisieCombinee(saisie: string): { s1: string; s2: string } | null {
  const brut = saisie.trim()
  if (brut === '') return null
  const sets = brut.split(/\s+/)
  const g1: string[] = []
  const g2: string[] = []
  for (const s of sets) {
    const m = /^(\d+)-(\d+)$/.exec(s)
    if (!m) return null
    g1.push(m[1])
    g2.push(m[2])
  }
  return { s1: g1.join(' '), s2: g2.join(' ') }
}

/** Reconstruit l'affichage « 9-3 » à partir des deux colonnes par équipe. */
export function formatScoreSets(s1: string | null, s2: string | null): string {
  const j1 = s1 ? parseJeux(s1) : null
  const j2 = s2 ? parseJeux(s2) : null
  if (!j1 || !j2 || j1.length !== j2.length || j1.length === 0) return ''
  return j1.map((a, i) => `${a}-${j2[i]}`).join(', ')
}
