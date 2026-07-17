import { describe, test, expect } from 'vitest'
import { nextPowerOfTwo, nbToursWinners, nourriciersDe, refNourricier } from '../lib/bracket'
import { libellesFeeders } from '../lib/libelles'
import { bracketInitial } from './helpers'

// Les 6 configs du brief (dont non-puissances-de-2 avec byes).
const CONFIGS: [number, number][] = [
  [8, 2],
  [11, 3],
  [13, 4],
  [16, 4],
  [16, 6],
  [32, 6],
]

describe.each(CONFIGS)('bracket — invariants de plan %i équipes / %i terrains', (n, C) => {
  const { plan } = bracketInitial(n, C)
  const total = nextPowerOfTwo(n)
  const nbTours = nbToursWinners(total)
  const nonBye = plan.filter((m) => !m.est_bye)

  test('terrain + creneau non nuls pour tout match non-bye', () => {
    expect(nonBye.every((m) => m.terrain != null && m.creneau != null)).toBe(true)
  })

  test('zéro conflit (terrain, creneau)', () => {
    const paires = new Set(plan.map((m) => `${m.terrain}#${m.creneau}`))
    expect(paires.size).toBe(plan.length)
  })

  test('moitie non-null SSI winners hors finale (NULL en finale + consolante)', () => {
    const winnersHorsFinale = plan.filter((m) => m.tableau === 'winners' && m.tour < nbTours)
    const ailleurs = plan.filter((m) => m.tableau === 'consolante' || (m.tableau === 'winners' && m.tour === nbTours))
    expect(winnersHorsFinale.every((m) => m.moitie === 'gauche' || m.moitie === 'droite')).toBe(true)
    expect(ailleurs.every((m) => m.moitie === null)).toBe(true)
  })

  test('zéro doublon de libellé de nourricier', () => {
    const matchs = plan.map((m) => ({ ...m, id: `${m.tableau}:${m.tour}:${m.match_num}` }))
    const terrainCounts = new Map<number, number>()
    for (const m of plan) if (m.terrain != null) terrainCounts.set(m.terrain, (terrainCounts.get(m.terrain) ?? 0) + 1)
    const parClef = new Map(plan.map((m) => [`${m.tableau}:${m.tour}:${m.match_num}`, m]))
    const ctx = { terrainCounts, nbTours }
    const labels: string[] = []
    for (const m of matchs) {
      for (const r of nourriciersDe(m, total)) {
        const f = parClef.get(`${r.tableau}:${r.tour}:${r.match_num}`)
        if (!f || f.est_bye) continue
        const type = m.tableau === 'consolante' && m.tour % 100 === 1 ? ('perdant' as const) : ('gagnant' as const)
        labels.push(refNourricier({ tableau: f.tableau, tour: f.tour, moitie: f.moitie }, type, { creneau: f.creneau!, terrain: f.terrain! }, ctx))
      }
    }
    expect(new Set(labels).size).toBe(labels.length)
  })
})

test('libellesFeeders : finale = « Vainqueur demi-gauche/droite »', () => {
  const { matchs } = bracketInitial(8, 2)
  const total = 8
  const labels = libellesFeeders(matchs, total)
  const finale = matchs.find((m) => m.tableau === 'winners' && m.tour === nbToursWinners(total))!
  expect(labels.get(finale.id)).toEqual({ e1: 'Vainqueur demi-gauche', e2: 'Vainqueur demi-droite' })
})
