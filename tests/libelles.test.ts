import { describe, test, expect } from 'vitest'
import { libellesFeeders } from '../lib/libelles'
import { nextPowerOfTwo } from '../lib/bracket'
import { bracketInitial } from './helpers'

describe('libellesFeeders', () => {
  test('winners → « Vainqueur… », consolante sous-tour 1 → « Perdant… »', () => {
    const { matchs } = bracketInitial(8, 2)
    const total = nextPowerOfTwo(8)
    const labels = libellesFeeders(matchs, total)

    // Un match winners tour 2 : ses slots référencent des « Vainqueur ».
    const w2 = matchs.find((m) => m.tableau === 'winners' && m.tour === 2)!
    const lw = labels.get(w2.id)!
    expect(lw.e1 + lw.e2).toMatch(/Vainqueur/)

    // Un match consolante sous-tour 1 (tour % 100 === 1) : « Perdant ».
    const c1 = matchs.find((m) => m.tableau === 'consolante' && m.tour % 100 === 1)!
    const lc = labels.get(c1.id)!
    expect(lc.e1 + lc.e2).toMatch(/Perdant/)
  })

  test('11/3 (byes) : zéro doublon de libellé de nourricier', () => {
    const { matchs } = bracketInitial(11, 3)
    const total = nextPowerOfTwo(11)
    const labels = libellesFeeders(matchs, total)
    const parClef = new Map(matchs.map((m) => [`${m.tableau}:${m.tour}:${m.match_num}`, m]))
    // On ne garde que les libellés réellement affichés (slot inconnu, nourricier non-bye).
    const affiches: string[] = []
    for (const m of matchs) {
      const l = labels.get(m.id)!
      for (const cote of ['e1', 'e2'] as const) {
        const lib = l[cote]
        if (lib === 'À déterminer') continue
        affiches.push(lib)
      }
    }
    void parClef
    // Chaque libellé « Vainqueur/Perdant T… » doit identifier un match unique.
    const feeders = affiches.filter((l) => /^(Vainqueur|Perdant) T/.test(l))
    expect(new Set(feeders).size).toBe(feeders.length)
  })
})
