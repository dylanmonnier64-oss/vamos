/*
 * Validation par simulation du moteur americano/mexicano (lib/americano.ts).
 *
 * Comme pour lib/bracket.ts, on ne se fie pas à la relecture : on JOUE une
 * soirée complète et on vérifie les invariants. N = 13 (non multiple de 4 →
 * byes forcés), R = 7 rounds, 3 terrains, scores aléatoires plausibles
 * (somme = points cible à chaque match). PRNG seedé → résultats reproductibles.
 *
 * Lancer :  npx tsx scripts/sim-americano.ts
 */
import {
  genererRoundAmericano,
  genererRoundMexicano,
  calculerClassement,
  type RoundGenere,
  type ResultatMatch,
  type LigneClassement,
} from '../lib/americano'
import { PADEL_SCORING } from '../lib/scoring/sport'

const N = 13
const R = 7
const TERRAINS = 3
const P = PADEL_SCORING.pointsParMatchDefaut // 24

// ── PRNG déterministe ───────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260710)
const randInt = (max: number) => Math.floor(rng() * (max + 1)) // 0..max inclus
function melange(ids: string[]): string[] {
  const c = [...ids]
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[c[i], c[j]] = [c[j], c[i]]
  }
  return c
}

const participants = Array.from({ length: N }, (_, i) => `J${String(i + 1).padStart(2, '0')}`)

/** Score final plausible : somme = P (rally-point, égalité possible). */
function scoreAleatoire(): [number, number] {
  const a = randInt(P)
  return [a, P - a]
}

function jouer(rg: RoundGenere): ResultatMatch[] {
  return rg.matchs.map((m) => {
    const [scoreA, scoreB] = scoreAleatoire()
    return { equipeA: m.equipeA, equipeB: m.equipeB, scoreA, scoreB }
  })
}

interface Sim {
  historique: RoundGenere[]
  resultats: ResultatMatch[]
  byeCount: Map<string, number>
  classementFinal: LigneClassement[]
  terrain1: string[][] // les 4 joueurs du terrain 1 par round
}

function simuler(mode: 'americano' | 'mexicano'): Sim {
  const historique: RoundGenere[] = []
  const resultats: ResultatMatch[] = []
  const byeCount = new Map(participants.map((p) => [p, 0]))
  const terrain1: string[][] = []

  for (let round = 1; round <= R; round++) {
    let rg: RoundGenere
    if (mode === 'americano') {
      rg = genererRoundAmericano(participants, historique, round, TERRAINS)
    } else {
      const classement = round === 1 ? [] : calculerClassement(participants, resultats, PADEL_SCORING)
      rg = genererRoundMexicano(participants, historique, classement, round, TERRAINS, { melange })
    }
    historique.push(rg)
    for (const b of rg.byes) byeCount.set(b, (byeCount.get(b) ?? 0) + 1)
    const t1 = rg.matchs.find((m) => m.terrain === 1)
    terrain1.push(t1 ? [...t1.equipeA, ...t1.equipeB] : [])
    for (const rm of jouer(rg)) resultats.push(rm)
  }

  return {
    historique,
    resultats,
    byeCount,
    classementFinal: calculerClassement(participants, resultats, PADEL_SCORING),
    terrain1,
  }
}

// ── Mesures ─────────────────────────────────────────────────────────────────

function statsPartenaires(historique: RoundGenere[]) {
  const paires = new Map<string, number>()
  const partenairesDe = new Map<string, Set<string>>()
  for (const p of participants) partenairesDe.set(p, new Set())
  const cle = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  for (const round of historique) {
    for (const m of round.matchs) {
      for (const [x, y] of [m.equipeA, m.equipeB] as const) {
        paires.set(cle(x, y), (paires.get(cle(x, y)) ?? 0) + 1)
        partenairesDe.get(x)!.add(y)
        partenairesDe.get(y)!.add(x)
      }
    }
  }
  const repeats = [...paires.values()]
  const maxRepeat = repeats.length ? Math.max(...repeats) : 0
  const pairesRepetees = repeats.filter((n) => n >= 2).length
  const distinctsMin = Math.min(...participants.map((p) => partenairesDe.get(p)!.size))
  const distinctsMax = Math.max(...participants.map((p) => partenairesDe.get(p)!.size))
  return { maxRepeat, pairesRepetees, distinctsMin, distinctsMax, nbPairesUniques: paires.size }
}

// ── Rapport + vérifications ─────────────────────────────────────────────────

let echecs = 0
function verifier(nom: string, ok: boolean, detail: string) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${nom} — ${detail}`)
  if (!ok) echecs++
}

function rapport(mode: 'americano' | 'mexicano', sim: Sim) {
  console.log(`\n================ ${mode.toUpperCase()} (N=${N}, R=${R}, ${TERRAINS} terrains, P=${P}) ================`)

  // Classement final
  console.log('\n Classement final :')
  console.log('  rang  joueur  joués  gagnés  marqués  concédés  diff  moyenne')
  for (const l of sim.classementFinal) {
    console.log(
      `  ${String(l.rang).padStart(3)}   ${l.id}    ${String(l.matchsJoues).padStart(3)}    ${String(
        l.matchsGagnes
      ).padStart(3)}     ${String(l.pointsMarques).padStart(4)}      ${String(l.pointsConcedes).padStart(4)}   ${String(
        l.diff
      ).padStart(4)}   ${l.moyenne.toFixed(2)}`
    )
  }

  const joues = sim.classementFinal.map((l) => l.matchsJoues)
  const minJ = Math.min(...joues)
  const maxJ = Math.max(...joues)
  const byes = [...sim.byeCount.values()]
  const minB = Math.min(...byes)
  const maxB = Math.max(...byes)
  const totalSlots = sim.resultats.length * 4
  const sommeJoues = joues.reduce((a, b) => a + b, 0)

  console.log('\n Répartition matchs joués :', JSON.stringify(distribution(joues)))
  console.log(' Répartition byes         :', JSON.stringify(distribution(byes)))

  console.log('\n Vérifications :')
  verifier(
    'nb de matchs cohérent avec les byes',
    maxJ - minJ <= 1,
    `joués ∈ [${minJ}, ${maxJ}] (écart ${maxJ - minJ} ≤ 1)`
  )
  verifier(
    'rotation des byes équitable',
    maxB - minB <= 1,
    `byes ∈ [${minB}, ${maxB}] (personne ne repose 2× avant que tous aient reposé 1×)`
  )
  verifier(
    'somme des matchs joués = places jouées',
    sommeJoues === totalSlots,
    `${sommeJoues} = ${totalSlots}`
  )
  verifier(
    'classement complet et non cassé',
    sim.classementFinal.length === N &&
      new Set(sim.classementFinal.map((l) => l.id)).size === N &&
      sim.classementFinal.every((l) => l.rang >= 1 && Number.isFinite(l.moyenne)),
    `${sim.classementFinal.length} lignes, rangs valides, moyennes finies`
  )

  if (mode === 'americano') {
    const s = statsPartenaires(sim.historique)
    console.log('\n Diversité des partenaires :', JSON.stringify(s))
    verifier(
      'rotation americano non dégénérée',
      s.maxRepeat <= 2,
      `max répétitions d'un même binôme = ${s.maxRepeat} (≤ 2 sur ${R} rounds), ${s.pairesRepetees} binômes répétés, partenaires distincts/joueur ∈ [${s.distinctsMin}, ${s.distinctsMax}]`
    )
  }

  if (mode === 'mexicano') {
    // Le terrain 1 du dernier round doit réunir le top-4 (par rang) des joueurs
    // en jeu ce round-là — c'est « la table des leaders ».
    const classementAvantDernier = calculerClassement(
      participants,
      sim.resultats.slice(0, sim.resultats.length - sim.historique[R - 1].matchs.length),
      PADEL_SCORING
    )
    const rang = new Map(classementAvantDernier.map((l) => [l.id, l.rang]))
    const enJeuDernier = participants.filter((p) => !sim.historique[R - 1].byes.includes(p))
    const top4 = [...enJeuDernier].sort((a, b) => (rang.get(a) ?? 1e9) - (rang.get(b) ?? 1e9)).slice(0, 4)
    const terrain1Dernier = sim.terrain1[R - 1]
    const memeEnsemble =
      top4.length === 4 &&
      terrain1Dernier.length === 4 &&
      top4.every((p) => terrain1Dernier.includes(p))
    verifier(
      'mexicano : terrain 1 = table des leaders (dernier round)',
      memeEnsemble,
      `top-4 par rang = [${top4.join(', ')}] ; terrain 1 = [${terrain1Dernier.join(', ')}]`
    )
  }
}

function distribution(vals: number[]): Record<number, number> {
  const d: Record<number, number> = {}
  for (const v of vals) d[v] = (d[v] ?? 0) + 1
  return d
}

// ── Test dédié : égalité de points (ne doit ni casser ni mal ranger) ────────
function testEgalite() {
  console.log('\n================ TEST ÉGALITÉ ================')
  // Un seul match 12-12 : les 4 joueurs à égalité parfaite (moyenne 12, 0 win,
  // diff 0) ; les 9 autres à 0 match. Deux groupes d'ex æquo attendus.
  const resultats: ResultatMatch[] = [
    { equipeA: ['J01', 'J02'], equipeB: ['J03', 'J04'], scoreA: 12, scoreB: 12 },
  ]
  const c = calculerClassement(participants, resultats, PADEL_SCORING)
  const parId = new Map(c.map((l) => [l.id, l]))
  const groupeJoue = ['J01', 'J02', 'J03', 'J04']
  const rangsJoue = new Set(groupeJoue.map((id) => parId.get(id)!.rang))
  const reste = participants.filter((p) => !groupeJoue.includes(p))
  const rangsReste = new Set(reste.map((id) => parId.get(id)!.rang))

  verifier(
    '4 joueurs à égalité parfaite partagent le même rang',
    rangsJoue.size === 1 && [...rangsJoue][0] === 1,
    `rang commun = ${[...rangsJoue][0]}`
  )
  verifier(
    'les 9 joueurs à 0 match partagent aussi un même rang (ex æquo)',
    rangsReste.size === 1,
    `rang commun = ${[...rangsReste][0]}`
  )
  verifier('aucune moyenne NaN/Infinity', c.every((l) => Number.isFinite(l.moyenne)), 'toutes finies')
}

// ── Run ─────────────────────────────────────────────────────────────────────
rapport('americano', simuler('americano'))
rapport('mexicano', simuler('mexicano'))
testEgalite()

console.log(`\n================ RÉSULTAT GLOBAL ================`)
if (echecs === 0) {
  console.log('  ✓ Toutes les vérifications sont PASS.')
  process.exit(0)
} else {
  console.log(`  ✗ ${echecs} vérification(s) en échec.`)
  process.exit(1)
}
