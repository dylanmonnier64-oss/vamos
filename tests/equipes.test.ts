import { describe, test, expect } from 'vitest'
import { parseEquipes } from '../lib/equipes'

describe('parseEquipes — textarea de saisie', () => {
  test('séparateurs / - & acceptés', () => {
    const r = parseEquipes('Alice / Bob\nCarl - Dan\nEve & Fay')
    expect(r.equipes).toEqual([
      { joueur1: 'Alice', joueur2: 'Bob' },
      { joueur1: 'Carl', joueur2: 'Dan' },
      { joueur1: 'Eve', joueur2: 'Fay' },
    ])
    expect(r.lignesInvalides).toHaveLength(0)
  })

  test('lignes vides ignorées', () => {
    const r = parseEquipes('\n  \nAlice / Bob\n\n')
    expect(r.equipes).toHaveLength(1)
    expect(r.lignesInvalides).toHaveLength(0)
  })

  test('un seul nom ou pas de séparateur → ligne invalide', () => {
    const r = parseEquipes('Alice / Bob\nSolo\nTrop / de / noms')
    expect(r.equipes).toEqual([{ joueur1: 'Alice', joueur2: 'Bob' }])
    expect(r.lignesInvalides).toEqual(['Solo', 'Trop / de / noms'])
  })
})
