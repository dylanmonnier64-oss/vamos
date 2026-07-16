// ============================================================================
// Score en sets (format élimination). Source de vérité UNIQUE pour déterminer
// le vainqueur d'un match : aucun autre endroit du code ne doit déduire le
// gagnant à partir d'un score. `parseScoreSets` est PURE (testable sans base).
//
// Modèle de stockage : deux colonnes `matchs.score_equipe1` / `score_equipe2`,
// chacune = les jeux GAGNÉS PAR CETTE ÉQUIPE, set par set, séparés par des
// espaces. Exemple d'un 6-4 6-3 pour l'équipe 1 : score_equipe1 = "6 6",
// score_equipe2 = "4 3". L'affichage « 6-4, 6-3 » se reconstruit en zippant les
// deux colonnes (cf. formatScoreSets). Deux colonnes + deux paramètres de RPC
// (p_score_equipe1 / p_score_equipe2) → un score par équipe, pas une chaîne
// combinée. Les points cible (team americano) vivent ailleurs
// (score_equipe1_points / score_equipe2_points) et ne concernent PAS ce module.
// ============================================================================

export interface ResultatScore {
  valide: boolean
  /** Motif de rejet (présent uniquement si !valide). */
  raison?: string
  /** Équipe gagnante : 1 = equipe1, 2 = equipe2 (présent uniquement si valide). */
  gagnant?: 1 | 2
  setsEquipe1?: number
  setsEquipe2?: number
}

/** Découpe une chaîne "6 6" en [6, 6]. Rejette tout ce qui n'est pas un entier ≥ 0. */
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
 * Valide un score en sets et détermine le vainqueur.
 * @param s1 jeux de l'équipe 1, set par set — ex. "6 6" ou "6 4 10"
 * @param s2 jeux de l'équipe 2, set par set — ex. "4 3" ou "4 6 8"
 *
 * Rejette : format non entier, nombre de sets différent entre les deux équipes,
 * score nul (0 set ou tout à zéro), un set sans vainqueur (jeux égaux — impossible
 * en padel), et l'égalité parfaite de sets (aucun vainqueur au match).
 */
export function parseScoreSets(s1: string, s2: string): ResultatScore {
  const j1 = parseJeux(s1)
  const j2 = parseJeux(s2)
  if (j1 === null || j2 === null) {
    return { valide: false, raison: 'Format de score invalide (attendu des entiers, ex. « 6 4 »).' }
  }
  if (j1.length !== j2.length) {
    return { valide: false, raison: 'Nombre de sets différent entre les deux équipes.' }
  }
  if (j1.length === 0) {
    return { valide: false, raison: 'Score vide.' }
  }

  let setsEquipe1 = 0
  let setsEquipe2 = 0
  let totalJeux = 0
  for (let i = 0; i < j1.length; i++) {
    const a = j1[i]
    const b = j2[i]
    totalJeux += a + b
    if (a === b) {
      return { valide: false, raison: `Set ${i + 1} sans vainqueur (${a}-${b}).` }
    }
    if (a > b) setsEquipe1++
    else setsEquipe2++
  }

  if (totalJeux === 0) {
    return { valide: false, raison: 'Score nul.' }
  }
  if (setsEquipe1 === setsEquipe2) {
    return { valide: false, raison: 'Égalité de sets : aucun vainqueur.' }
  }

  return {
    valide: true,
    gagnant: setsEquipe1 > setsEquipe2 ? 1 : 2,
    setsEquipe1,
    setsEquipe2,
  }
}

/**
 * Parse une saisie combinée « 6-4 6-3 » (sets séparés par des espaces, chaque
 * set « a-b ») en deux colonnes par équipe { s1: "6 6", s2: "4 3" }. Renvoie
 * null si le format est invalide. C'est l'inverse de formatScoreSets ; la
 * validation « padel » (vainqueur, égalités…) reste à parseScoreSets.
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

/** Reconstruit l'affichage « 6-4, 6-3 » à partir des deux colonnes par équipe. */
export function formatScoreSets(s1: string | null, s2: string | null): string {
  const j1 = s1 ? parseJeux(s1) : null
  const j2 = s2 ? parseJeux(s2) : null
  if (!j1 || !j2 || j1.length !== j2.length || j1.length === 0) return ''
  return j1.map((a, i) => `${a}-${j2[i]}`).join(', ')
}
