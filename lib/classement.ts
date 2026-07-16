// Cœur de classement partagé — americano individuel (par joueur) ET team
// americano (par paire). Seule l'AGRÉGATION (qui reçoit les points d'un match)
// diffère entre les deux formats ; le tri et le départage sont identiques, donc
// factorisés ici plutôt que dupliqués.

export interface StatsCumul {
  id: string
  matchsJoues: number
  matchsGagnes: number
  pointsMarques: number
  pointsConcedes: number
}

export interface LigneClassement {
  /** Identité classée : id de participant (individuel) ou d'équipe (team). */
  id: string
  rang: number
  matchsJoues: number
  matchsGagnes: number
  pointsMarques: number
  pointsConcedes: number
  diff: number
  total: number
  moyenne: number
}

const EPS = 1e-9

/**
 * Trie et attribue les rangs à partir de stats cumulées. Départage, dans cet
 * ordre exact : (1) total, ou moyenne par match si le nombre de matchs diffère
 * entre entités (byes) ; (2) matchs gagnés ; (3) diff marqués − concédés ;
 * (4) ex æquo → même rang (classement type compétition : 1, 2, 2, 4). Aucun
 * départage supplémentaire inventé.
 */
export function classer(stats: StatsCumul[]): LigneClassement[] {
  const lignes: LigneClassement[] = stats.map((s) => ({
    id: s.id,
    rang: 0,
    matchsJoues: s.matchsJoues,
    matchsGagnes: s.matchsGagnes,
    pointsMarques: s.pointsMarques,
    pointsConcedes: s.pointsConcedes,
    diff: s.pointsMarques - s.pointsConcedes,
    total: s.pointsMarques,
    moyenne: s.matchsJoues > 0 ? s.pointsMarques / s.matchsJoues : 0,
  }))

  // Critère primaire : total si tout le monde a joué autant de matchs, sinon
  // moyenne (protège les joueurs ayant reposé / arrivés en retard).
  const parMoyenne = new Set(lignes.map((l) => l.matchsJoues)).size > 1
  const primaire = (l: LigneClassement) => (parMoyenne ? l.moyenne : l.total)

  lignes.sort(
    (x, y) =>
      primaire(y) - primaire(x) ||
      y.matchsGagnes - x.matchsGagnes ||
      y.diff - x.diff ||
      x.id.localeCompare(y.id)
  )

  const egales = (x: LigneClassement, y: LigneClassement) =>
    Math.abs(primaire(x) - primaire(y)) < EPS &&
    x.matchsGagnes === y.matchsGagnes &&
    x.diff === y.diff

  lignes.forEach((l, i) => {
    l.rang = i > 0 && egales(l, lignes[i - 1]) ? lignes[i - 1].rang : i + 1
  })

  return lignes
}
