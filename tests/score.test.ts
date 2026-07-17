import { describe, test, expect } from 'vitest'
import { parseScoreSets, parseSaisieCombinee, formatScoreSets } from '../lib/score'

// Format élimination = UN set à 9 jeux (« 9-3 »).
describe('parseScoreSets — un set à 9 jeux', () => {
  test('9-3 → valide, équipe 1 gagne', () => {
    const r = parseScoreSets('9', '3')
    expect(r.valide).toBe(true)
    expect(r.gagnant).toBe(1)
    expect(r.jeuxEquipe1).toBe(9)
    expect(r.jeuxEquipe2).toBe(3)
  })

  test('3-9 → valide, équipe 2 gagne', () => {
    expect(parseScoreSets('3', '9')).toMatchObject({ valide: true, gagnant: 2 })
  })

  test('9-8 (mort subite) et 10-8 (2 jeux d’écart) → valides', () => {
    expect(parseScoreSets('9', '8').valide).toBe(true)
    expect(parseScoreSets('10', '8').valide).toBe(true)
  })

  test('9-0 → valide', () => {
    expect(parseScoreSets('9', '0').valide).toBe(true)
  })

  test('5-3 → rejeté (set incomplet)', () => {
    const r = parseScoreSets('5', '3')
    expect(r.valide).toBe(false)
    expect(r.raison).toMatch(/incomplet/i)
  })

  test('9-9 → rejeté (pas de vainqueur)', () => {
    expect(parseScoreSets('9', '9')).toMatchObject({ valide: false })
  })

  test('multi-set « 6 6 »/« 4 3 » → rejeté (un seul set)', () => {
    const r = parseScoreSets('6 6', '4 3')
    expect(r.valide).toBe(false)
    expect(r.raison).toMatch(/un seul set/i)
  })

  test('vide / non entier / négatif / tiret → rejetés', () => {
    expect(parseScoreSets('', '').valide).toBe(false)
    expect(parseScoreSets('9', 'abc').valide).toBe(false)
    expect(parseScoreSets('-9', '3').valide).toBe(false)
    expect(parseScoreSets('9-3', '3').valide).toBe(false)
  })
})

describe('parseSaisieCombinee', () => {
  test('« 9-3 » → { s1: "9", s2: "3" }', () => {
    expect(parseSaisieCombinee('9-3')).toEqual({ s1: '9', s2: '3' })
  })
  test('sans tiret ou vide → null', () => {
    expect(parseSaisieCombinee('9 3')).toBeNull()
    expect(parseSaisieCombinee('')).toBeNull()
  })
})

describe('formatScoreSets', () => {
  test('("9","3") → "9-3" ; (null,null) → ""', () => {
    expect(formatScoreSets('9', '3')).toBe('9-3')
    expect(formatScoreSets(null, null)).toBe('')
  })
})
