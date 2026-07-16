import type { SportScoringConfig } from './scoring/sport'
import { classer, type LigneClassement, type StatsCumul } from './classement'

// ============================================================================
// Moteur americano / mexicano — SÉPARÉ de lib/bracket.ts (élimination) et
// lib/fft.ts (barème FFT). Ici : inscription individuelle, paires reformées à
// chaque round, classement individuel cumulé. Fonctions PURES (aucun accès
// Supabase) : l'appelant charge l'état, appelle ces fonctions, persiste le
// résultat — mêmes raisons de testabilité que bracket.ts.
//
// Ce moteur consomme un SportScoringConfig (lib/scoring/sport.ts) pour la règle
// de points par joueur et la fin de match, et le cœur de classement partagé
// lib/classement.ts (tri/départage), plutôt que de les coder/dupliquer.
// ============================================================================

// Le type de ligne de classement est partagé (lib/classement.ts) — `id` =
// participant ici. Ré-exporté pour les consommateurs de ce module.
export type { LigneClassement } from './classement'

// ── Types d'échange (identités = ids de participants) ───────────────────────

/** Un match proposé pour un round : équipe A (2 ids) vs équipe B (2 ids). */
export interface MatchPropose {
  round: number
  terrain: number
  equipeA: readonly [string, string]
  equipeB: readonly [string, string]
}

/** Résultat d'un round : ses matchs + les participants au repos (byes). */
export interface RoundGenere {
  round: number
  matchs: MatchPropose[]
  byes: string[]
}

/** Un match terminé, tel que consommé pour le classement et l'historique. */
export interface ResultatMatch {
  equipeA: readonly [string, string]
  equipeB: readonly [string, string]
  scoreA: number
  scoreB: number
}

// ── Utilitaires internes ────────────────────────────────────────────────────

/** Nombre de matchs simultanés d'un round = min(⌊actifs/4⌋, terrains). */
export function nbMatchsRound(nbActifs: number, nbTerrains: number): number {
  return Math.min(Math.floor(nbActifs / 4), Math.max(0, nbTerrains))
}

function cle(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

interface Compteurs {
  partenaire: Map<string, number> // cle(i,j) -> nb de fois partenaires
  adversaire: Map<string, number> // cle(i,j) -> nb de fois adversaires
  byes: Map<string, number> // id -> nb de repos
}

/** Agrège partenaires / adversaires / byes depuis les rounds déjà générés. */
function compteurs(historique: RoundGenere[]): Compteurs {
  const partenaire = new Map<string, number>()
  const adversaire = new Map<string, number>()
  const byes = new Map<string, number>()
  const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

  for (const round of historique) {
    for (const m of round.matchs) {
      inc(partenaire, cle(m.equipeA[0], m.equipeA[1]))
      inc(partenaire, cle(m.equipeB[0], m.equipeB[1]))
      for (const a of m.equipeA) for (const b of m.equipeB) inc(adversaire, cle(a, b))
    }
    for (const p of round.byes) byes.set(p, (byes.get(p) ?? 0) + 1)
  }
  return { partenaire, adversaire, byes }
}

/**
 * Choisit les byes du round : les `nbByes` participants ayant le MOINS reposé
 * jusqu'ici (rotation équitable → personne ne repose deux fois avant que tous
 * aient reposé une fois). Départage stable par ordre d'entrée.
 */
function choisirByes(actifs: string[], nbByes: number, byes: Map<string, number>): string[] {
  if (nbByes <= 0) return []
  return actifs
    .map((id, i) => ({ id, n: byes.get(id) ?? 0, i }))
    .sort((a, b) => a.n - b.n || a.i - b.i)
    .slice(0, nbByes)
    .map((x) => x.id)
}

// Poids : on minimise D'ABORD les répétitions de partenaire, ENSUITE d'adversaire.
const W_PARTENAIRE = 1000
const W_ADVERSAIRE = 1

// ── Americano — rotation pré-calculée, indépendante des résultats ───────────

/**
 * Génère un round americano. Heuristique gloutonne : à chaque match, on choisit
 * pour un joueur son partenaire le moins déjà vu, puis la paire adverse
 * minimisant (répétitions de partenaire ×1000 + répétitions d'adversaire ×1).
 * Objectif : maximiser la diversité partenaires/adversaires sur la soirée.
 */
export function genererRoundAmericano(
  actifs: string[],
  historique: RoundGenere[],
  round: number,
  nbTerrains: number
): RoundGenere {
  const { partenaire, adversaire, byes } = compteurs(historique)
  const nbMatchs = nbMatchsRound(actifs.length, nbTerrains)
  const nbByes = actifs.length - nbMatchs * 4

  const repos = choisirByes(actifs, nbByes, byes)
  const reposSet = new Set(repos)
  const restants = actifs.filter((id) => !reposSet.has(id))

  const nb = (m: Map<string, number>, a: string, b: string) => m.get(cle(a, b)) ?? 0
  const matchs: MatchPropose[] = []

  for (let terrain = 1; terrain <= nbMatchs; terrain++) {
    const p = restants[0]

    // Partenaire de p : le moins déjà partenaire (départage : ordre).
    let q = restants[1]
    for (const cand of restants.slice(1)) {
      if (nb(partenaire, p, cand) < nb(partenaire, p, q)) q = cand
    }

    // Paire adverse {r,s} : minimise partenaire(r,s) ×1000 + adversaires vs {p,q}.
    const dispo = restants.filter((id) => id !== p && id !== q)
    let meilleur: { r: string; s: string; cout: number } | null = null
    for (let a = 0; a < dispo.length; a++) {
      for (let b = a + 1; b < dispo.length; b++) {
        const r = dispo[a]
        const s = dispo[b]
        const cout =
          W_PARTENAIRE * nb(partenaire, r, s) +
          W_ADVERSAIRE *
            (nb(adversaire, p, r) + nb(adversaire, p, s) + nb(adversaire, q, r) + nb(adversaire, q, s))
        if (meilleur === null || cout < meilleur.cout) meilleur = { r, s, cout }
      }
    }
    // meilleur est non-null : dispo contient toujours ≥ 2 joueurs (multiple de 4).
    const { r, s } = meilleur as { r: string; s: string; cout: number }

    matchs.push({ round, terrain, equipeA: [p, q], equipeB: [r, s] })

    // Retirer les 4 joueurs placés.
    for (const id of [p, q, r, s]) restants.splice(restants.indexOf(id), 1)
  }

  return { round, matchs, byes: repos }
}

// ── Mexicano — appariement dynamique par classement ─────────────────────────

/**
 * Génère un round mexicano. Round 1 : ordre par niveau si fourni, sinon aléatoire
 * (via `melange`). Round ≥ 2 : trie les joueurs par classement courant, forme
 * des groupes de 4 consécutifs (rangs 1-4 → terrain 1, 5-8 → terrain 2, …), et
 * dans chaque groupe la paire = 1er + 3e contre 2e + 4e. Les byes suivent la
 * même rotation équitable que l'americano (indépendante du classement).
 */
export function genererRoundMexicano(
  actifs: string[],
  historique: RoundGenere[],
  classement: LigneClassement[],
  round: number,
  nbTerrains: number,
  options?: { niveaux?: Map<string, number>; melange?: (ids: string[]) => string[] }
): RoundGenere {
  const { byes } = compteurs(historique)
  const nbMatchs = nbMatchsRound(actifs.length, nbTerrains)
  const nbByes = actifs.length - nbMatchs * 4

  const repos = choisirByes(actifs, nbByes, byes)
  const reposSet = new Set(repos)
  const enJeu = actifs.filter((id) => !reposSet.has(id))

  // Ordonner les joueurs en jeu.
  let ordre: string[]
  if (round <= 1) {
    const niveaux = options?.niveaux
    if (niveaux && enJeu.some((id) => niveaux.has(id))) {
      // Par niveau décroissant (niveau manquant = 0), départage stable.
      ordre = enJeu
        .map((id, i) => ({ id, n: niveaux.get(id) ?? 0, i }))
        .sort((a, b) => b.n - a.n || a.i - b.i)
        .map((x) => x.id)
    } else {
      ordre = options?.melange ? options.melange(enJeu) : [...enJeu]
    }
  } else {
    // Par rang courant (joueurs sans classement — 0 match — placés à la fin).
    const rang = new Map(classement.map((l) => [l.id, l.rang]))
    ordre = enJeu
      .map((id, i) => ({ id, r: rang.get(id) ?? Number.MAX_SAFE_INTEGER, i }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map((x) => x.id)
  }

  const matchs: MatchPropose[] = []
  for (let g = 0; g < nbMatchs; g++) {
    const [a, b, c, d] = ordre.slice(g * 4, g * 4 + 4)
    // 1er + 3e contre 2e + 4e.
    matchs.push({ round, terrain: g + 1, equipeA: [a, c], equipeB: [b, d] })
  }

  return { round, matchs, byes: repos }
}

// ── Classement individuel cumulé ────────────────────────────────────────────

/**
 * Classement individuel : chaque joueur cumule les points marqués par SON
 * équipe à chaque match (via config.pointsJoueurPourMatch). Le tri et le
 * départage (total|moyenne → gagnés → diff → ex æquo) sont délégués au cœur
 * partagé `classer` (lib/classement.ts) — même logique que le team americano.
 */
export function calculerClassement(
  participants: string[],
  resultats: ResultatMatch[],
  config: SportScoringConfig
): LigneClassement[] {
  const acc = new Map<
    string,
    { joues: number; gagnes: number; marques: number; concedes: number }
  >()
  for (const id of participants) acc.set(id, { joues: 0, gagnes: 0, marques: 0, concedes: 0 })

  const applique = (
    equipe: readonly [string, string],
    scoreEquipe: number,
    scoreAdverse: number
  ) => {
    const pts = config.pointsJoueurPourMatch(scoreEquipe, scoreAdverse)
    const gagne = scoreEquipe > scoreAdverse
    for (const id of equipe) {
      const a = acc.get(id)
      if (!a) continue // score d'un joueur hors liste : ignoré défensivement
      a.joues += 1
      a.marques += pts
      a.concedes += scoreAdverse
      if (gagne) a.gagnes += 1
    }
  }
  for (const m of resultats) {
    applique(m.equipeA, m.scoreA, m.scoreB)
    applique(m.equipeB, m.scoreB, m.scoreA)
  }

  const stats: StatsCumul[] = [...acc.entries()].map(([id, a]) => ({
    id,
    matchsJoues: a.joues,
    matchsGagnes: a.gagnes,
    pointsMarques: a.marques,
    pointsConcedes: a.concedes,
  }))
  return classer(stats)
}

// ── Saisie de score — validation via le SportScoringConfig ──────────────────

/**
 * Valide un score final saisi : scores ≥ 0 et somme atteignant exactement le
 * total cible (rally-point, l'égalité est acceptée, pas de 2 pts d'écart). On
 * passe par config.matchTermine pour la règle « cible atteinte ».
 */
export function validerScoreMatch(
  scoreA: number,
  scoreB: number,
  pointsParMatch: number,
  config: SportScoringConfig
): { valide: boolean; raison?: string } {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return { valide: false, raison: 'Scores entiers positifs requis.' }
  }
  if (scoreA + scoreB !== pointsParMatch) {
    return { valide: false, raison: `La somme des scores doit valoir ${pointsParMatch}.` }
  }
  if (!config.matchTermine(scoreA, scoreB, pointsParMatch)) {
    return { valide: false, raison: 'Match non terminé selon la règle du sport.' }
  }
  return { valide: true }
}
