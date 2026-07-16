import type { SportScoringConfig } from './scoring/sport'
import { classer, type LigneClassement, type StatsCumul } from './classement'
import { validerScoreMatch } from './americano'

// ============================================================================
// Moteur TEAM AMERICANO — paires FIXES (réutilise `equipes`), round-robin entre
// paires, classement cumulé PAR PAIRE. Séparé de :
//   - lib/bracket.ts    (élimination)
//   - lib/americano.ts  (americano/mexicano INDIVIDUEL, partenaires tournants)
// Fonctions PURES (aucun accès Supabase). Réutilise le cœur de classement
// partagé (lib/classement.ts) et la validation de score (lib/americano.ts,
// via PADEL_SCORING) plutôt que de les dupliquer.
// ============================================================================

// Le score/fin de match est identique aux formats à points cible.
export { validerScoreMatch } from './americano'
export type { LigneClassement } from './classement'

/** Un match de round-robin : paire equipe1 vs paire equipe2 sur un terrain. */
export interface MatchRoundRobin {
  round: number // → matchs.tour (numéro de round-robin ; tableau IS NULL)
  matchNum: number // → matchs.match_num (index dans le round)
  terrain: number | null // 1..C d'emblée, null si en file (surplus du round)
  equipe1: string
  equipe2: string
}

export interface ScheduleRoundRobin {
  matchs: MatchRoundRobin[]
  /** round -> paires au repos ce round (n impair → 1 paire/round). */
  byesParRound: Map<number, string[]>
  nbRounds: number
}

/** Un match terminé côté paires, pour le classement. */
export interface ResultatMatchEquipe {
  equipe1: string
  equipe2: string
  score1: number
  score2: number
}

const BYE = '__BYE__'

/**
 * Planifie le round-robin par la « méthode du cercle » : on fixe une paire et
 * on fait tourner les autres. n paires → n−1 rounds (chaque paire en affronte
 * une autre exactement une fois par round-robin complet). Si n est impair, on
 * ajoute une paire fantôme → la paire en face d'elle est au repos ce round-là,
 * et le repos tourne équitablement (chaque paire repose exactement une fois).
 *
 * `nbRoundsMax` plafonne la soirée (round-robin partiel) : on garde les
 * `nbRoundsMax` premiers rounds du cercle. Par terrain : les `nbTerrains`
 * premiers matchs d'un round démarrent d'emblée (terrain assigné), le surplus
 * attend un terrain libre (terrain = null à la génération).
 */
export function genererRoundRobin(
  equipes: string[],
  nbTerrains: number,
  nbRoundsMax?: number
): ScheduleRoundRobin {
  if (equipes.length < 2) return { matchs: [], byesParRound: new Map(), nbRounds: 0 }

  const liste = [...equipes]
  if (liste.length % 2 === 1) liste.push(BYE)
  const m = liste.length // pair
  const roundsComplets = m - 1
  const nbRounds = nbRoundsMax != null ? Math.min(roundsComplets, Math.max(0, nbRoundsMax)) : roundsComplets

  const fixe = liste[0]
  let reste = liste.slice(1)

  const matchs: MatchRoundRobin[] = []
  const byesParRound = new Map<number, string[]>()

  for (let round = 1; round <= nbRounds; round++) {
    const ordre = [fixe, ...reste]
    const byes: string[] = []
    let matchNum = 1
    for (let i = 0; i < m / 2; i++) {
      const a = ordre[i]
      const b = ordre[m - 1 - i]
      if (a === BYE) {
        byes.push(b)
        continue
      }
      if (b === BYE) {
        byes.push(a)
        continue
      }
      const terrain = matchNum <= nbTerrains ? matchNum : null
      matchs.push({ round, matchNum, terrain, equipe1: a, equipe2: b })
      matchNum++
    }
    byesParRound.set(round, byes)

    // Rotation du cercle : la paire fixe reste, on tourne les autres d'un cran.
    reste = [reste[reste.length - 1], ...reste.slice(0, reste.length - 1)]
  }

  return { matchs, byesParRound, nbRounds }
}

/**
 * Classement PAR PAIRE : chaque paire cumule les points marqués par elle-même
 * (via config.pointsJoueurPourMatch) sur tous ses matchs. Tri/départage délégués
 * au cœur partagé `classer` (même logique exacte que l'americano individuel,
 * appliquée à l'échelle paire) : total|moyenne → gagnés → diff → ex æquo.
 */
export function calculerClassementEquipes(
  equipes: string[],
  resultats: ResultatMatchEquipe[],
  config: SportScoringConfig
): LigneClassement[] {
  const acc = new Map<
    string,
    { joues: number; gagnes: number; marques: number; concedes: number }
  >()
  for (const e of equipes) acc.set(e, { joues: 0, gagnes: 0, marques: 0, concedes: 0 })

  const applique = (id: string, scoreEquipe: number, scoreAdverse: number) => {
    const a = acc.get(id)
    if (!a) return // paire hors liste : ignorée défensivement
    a.joues += 1
    a.marques += config.pointsJoueurPourMatch(scoreEquipe, scoreAdverse)
    a.concedes += scoreAdverse
    if (scoreEquipe > scoreAdverse) a.gagnes += 1
  }
  for (const m of resultats) {
    applique(m.equipe1, m.score1, m.score2)
    applique(m.equipe2, m.score2, m.score1)
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
