import { describe, test, expect } from 'vitest'
import { classer, type StatsCumul } from '../lib/classement'

const s = (id: string, j: number, g: number, m: number, c: number): StatsCumul => ({
  id,
  matchsJoues: j,
  matchsGagnes: g,
  pointsMarques: m,
  pointsConcedes: c,
})

describe('classer — tri + départage', () => {
  test('tri par total (tout le monde a joué autant)', () => {
    const c = classer([s('a', 3, 1, 40, 30), s('b', 3, 3, 70, 20), s('c', 3, 2, 55, 25)])
    expect(c.map((l) => l.id)).toEqual(['b', 'c', 'a'])
    expect(c.map((l) => l.rang)).toEqual([1, 2, 3])
  })

  test('ex æquo → même rang (1, 2, 2, 4)', () => {
    const c = classer([
      s('a', 2, 2, 50, 10),
      s('b', 2, 1, 30, 30),
      s('c', 2, 1, 30, 30),
      s('d', 2, 0, 10, 50),
    ])
    expect(c.map((l) => l.rang)).toEqual([1, 2, 2, 4])
  })

  test('nombre de matchs différent → tri par moyenne (protège les byes)', () => {
    // a : 60 pts en 2 matchs (moy 30) ; b : 80 pts en 4 matchs (moy 20).
    const c = classer([s('a', 2, 2, 60, 20), s('b', 4, 2, 80, 40)])
    expect(c[0].id).toBe('a') // meilleure moyenne malgré un total inférieur
  })

  test('aucune moyenne NaN/Infinity (0 match)', () => {
    const c = classer([s('a', 0, 0, 0, 0)])
    expect(Number.isFinite(c[0].moyenne)).toBe(true)
  })
})
