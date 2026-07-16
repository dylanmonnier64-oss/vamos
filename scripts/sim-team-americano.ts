/*
 * Validation par simulation du moteur team americano (lib/team-americano.ts).
 * On ne se fie pas à la relecture : on génère de vrais round-robins et on
 * vérifie les invariants de scheduling + le classement par paire.
 *
 * Lancer :  npx tsx scripts/sim-team-americano.ts
 */
import {
  genererRoundRobin,
  calculerClassementEquipes,
  type ResultatMatchEquipe,
  type ScheduleRoundRobin,
} from '../lib/team-americano'
import { PADEL_SCORING } from '../lib/scoring/sport'

const P = PADEL_SCORING.pointsParMatchDefaut // 24

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260710)
const randInt = (max: number) => Math.floor(rng() * (max + 1))

const cle = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const paires = (n: number) => Array.from({ length: n }, (_, i) => `E${String(i + 1).padStart(2, '0')}`)

let echecs = 0
function verifier(nom: string, ok: boolean, detail: string) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${nom} — ${detail}`)
  if (!ok) echecs++
}

// ── Vérification de la structure d'un schedule round-robin ──────────────────
function verifierSchedule(
  titre: string,
  n: number,
  nbTerrains: number,
  nbRoundsMax: number | undefined,
  fullRR: boolean
) {
  const equipes = paires(n)
  const sched: ScheduleRoundRobin = genererRoundRobin(equipes, nbTerrains, nbRoundsMax)

  console.log(`\n---- ${titre} : n=${n} paires, ${nbTerrains} terrains, cap=${nbRoundsMax ?? '∞'} ----`)
  console.log(
    `  rounds=${sched.nbRounds}, matchs=${sched.matchs.length}` +
      (fullRR ? `, attendu (full RR) = C(${n},2) = ${(n * (n - 1)) / 2}` : '')
  )

  // 1. Rencontres : aucune paire ne rencontre une autre plus d'une fois ; en
  //    round-robin complet, chaque couple se rencontre exactement une fois.
  const rencontres = new Map<string, number>()
  for (const m of sched.matchs) {
    const k = cle(m.equipe1, m.equipe2)
    rencontres.set(k, (rencontres.get(k) ?? 0) + 1)
  }
  const maxRencontre = Math.max(0, ...rencontres.values())
  if (fullRR) {
    const attendu = (n * (n - 1)) / 2
    verifier(
      'round-robin complet : chaque couple exactement 1 fois',
      rencontres.size === attendu && maxRencontre === 1 && sched.matchs.length === attendu,
      `${rencontres.size} couples distincts, max rencontres = ${maxRencontre}`
    )
  } else {
    verifier(
      'round-robin partiel : aucun couple rencontré > 1 fois',
      maxRencontre <= 1,
      `${rencontres.size} couples, max rencontres = ${maxRencontre}`
    )
  }

  // 2. Aucune paire dans deux matchs du même round (pas de double-booking).
  let doubleBooking = false
  for (let r = 1; r <= sched.nbRounds; r++) {
    const vus = new Set<string>()
    for (const m of sched.matchs.filter((x) => x.round === r)) {
      if (vus.has(m.equipe1) || vus.has(m.equipe2)) doubleBooking = true
      vus.add(m.equipe1)
      vus.add(m.equipe2)
    }
  }
  verifier('pas de double-booking (paire ≤ 1 match/round)', !doubleBooking, doubleBooking ? 'collision détectée' : 'aucune collision')

  // 3. Repos équitable : sur un RR complet impair, chaque paire repose 1 fois ;
  //    sinon l'écart des byes reste ≤ 1.
  const byeCount = new Map(equipes.map((e) => [e, 0]))
  for (const [, byes] of sched.byesParRound) for (const b of byes) byeCount.set(b, (byeCount.get(b) ?? 0) + 1)
  const bvals = [...byeCount.values()]
  const minB = Math.min(...bvals)
  const maxB = Math.max(...bvals)
  verifier(
    'repos équitable entre paires',
    maxB - minB <= 1,
    `byes/paire ∈ [${minB}, ${maxB}]` + (n % 2 === 1 && fullRR ? ` (impair, RR complet → 1 chacun attendu)` : '')
  )

  // 4. Terrains : par round, au plus `nbTerrains` matchs assignés, terrains distincts.
  let terrainsOk = true
  for (let r = 1; r <= sched.nbRounds; r++) {
    const assignes = sched.matchs.filter((x) => x.round === r && x.terrain !== null).map((x) => x.terrain)
    if (assignes.length > nbTerrains || new Set(assignes).size !== assignes.length) terrainsOk = false
  }
  verifier('terrains : ≤ C simultanés/round, distincts', terrainsOk, `≤ ${nbTerrains} par round, sans doublon`)
}

// ── Classement par paire (avec test d'égalité) ──────────────────────────────
function verifierClassement(n: number) {
  console.log(`\n---- Classement par paire : n=${n}, RR complet, scores aléatoires ----`)
  const equipes = paires(n)
  const sched = genererRoundRobin(equipes, 3)
  const resultats: ResultatMatchEquipe[] = sched.matchs.map((m) => {
    const s1 = randInt(P)
    return { equipe1: m.equipe1, equipe2: m.equipe2, score1: s1, score2: P - s1 }
  })
  const classement = calculerClassementEquipes(equipes, resultats, PADEL_SCORING)

  console.log('  rang  paire  joués  gagnés  marqués  concédés  diff  moyenne')
  for (const l of classement) {
    console.log(
      `  ${String(l.rang).padStart(3)}   ${l.id}    ${String(l.matchsJoues).padStart(3)}     ${String(
        l.matchsGagnes
      ).padStart(3)}     ${String(l.pointsMarques).padStart(4)}      ${String(l.pointsConcedes).padStart(4)}  ${String(
        l.diff
      ).padStart(4)}   ${l.moyenne.toFixed(2)}`
    )
  }
  verifier(
    'classement complet et non cassé',
    classement.length === n &&
      new Set(classement.map((l) => l.id)).size === n &&
      classement.every((l) => l.rang >= 1 && Number.isFinite(l.moyenne)),
    `${classement.length} lignes, rangs valides, moyennes finies`
  )

  // Test d'égalité : 2 paires avec des matchs miroir → mêmes stats → même rang.
  const eg = calculerClassementEquipes(
    ['E01', 'E02', 'E03', 'E04'],
    [
      { equipe1: 'E01', equipe2: 'E03', score1: 15, score2: 9 },
      { equipe1: 'E02', equipe2: 'E04', score1: 15, score2: 9 },
    ],
    PADEL_SCORING
  )
  const parId = new Map(eg.map((l) => [l.id, l]))
  verifier(
    'égalité : 2 paires aux stats identiques partagent le rang',
    parId.get('E01')!.rang === parId.get('E02')!.rang &&
      parId.get('E03')!.rang === parId.get('E04')!.rang,
    `E01=${parId.get('E01')!.rang}, E02=${parId.get('E02')!.rang} | E03=${parId.get('E03')!.rang}, E04=${parId.get('E04')!.rang}`
  )
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log('================ TEAM AMERICANO — scheduling round-robin ================')
verifierSchedule('9 paires (impair) — RR complet', 9, 3, undefined, true)
verifierSchedule('7 paires (impair) — RR complet', 7, 2, undefined, true)
verifierSchedule('9 paires — plafonné à 5 rounds', 9, 3, 5, false)
verifierClassement(9)

console.log(`\n================ RÉSULTAT GLOBAL ================`)
if (echecs === 0) {
  console.log('  ✓ Toutes les vérifications sont PASS.')
  process.exit(0)
} else {
  console.log(`  ✗ ${echecs} vérification(s) en échec.`)
  process.exit(1)
}
