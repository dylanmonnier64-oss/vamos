import { describe, test, expect } from 'vitest'
import { getPoints, fourchettePoints } from '../lib/fft'

describe('getPoints — barème officiel FFT', () => {
  test('P100 / 8 équipes : 1er = 100, 8e = 1', () => {
    expect(getPoints('P100', 8, 1)).toBe(100)
    expect(getPoints('P100', 8, 8)).toBe(1)
  })
  test('P25 / 16 : 1er = 25, 16e = 1', () => {
    expect(getPoints('P25', 16, 1)).toBe(25)
    expect(getPoints('P25', 16, 16)).toBe(1)
  })
  test('P1000 → null (erreur doc FFT assumée)', () => {
    expect(getPoints('P1000', 8, 1)).toBeNull()
  })
  test('place inexistante pour la taille → null', () => {
    expect(getPoints('P100', 8, 20)).toBeNull()
  })
})

describe('fourchettePoints — bloc points indicatifs /t', () => {
  test('P100/8 « Places 1-8 » → {1, 100}', () => {
    expect(fourchettePoints('Places 1-8', 'P100', 8)).toEqual({ min: 1, max: 100 })
  })
  test('P100/8 « Places 1-4 » → {40, 100}', () => {
    expect(fourchettePoints('Places 1-4', 'P100', 8)).toEqual({ min: 40, max: 100 })
  })
  test('P100/8 « Places 5-8 » → {1, 25}', () => {
    expect(fourchettePoints('Places 5-8', 'P100', 8)).toEqual({ min: 1, max: 25 })
  })
  test('places au-delà de la tranche → bornées', () => {
    expect(fourchettePoints('Places 1-16', 'P100', 8)).toEqual({ min: 1, max: 100 })
  })
  test('P1000 → null (bloc masqué, jamais « null »)', () => {
    expect(fourchettePoints('Places 1-8', 'P1000', 8)).toBeNull()
  })
  test('entrées invalides → null', () => {
    expect(fourchettePoints(null, 'P100', 8)).toBeNull()
    expect(fourchettePoints('', 'P100', 8)).toBeNull()
    expect(fourchettePoints('Finale', 'P100', 8)).toBeNull()
  })
  test('P25/16 « Places 9-16 » → {1, 8}', () => {
    expect(fourchettePoints('Places 9-16', 'P25', 16)).toEqual({ min: 1, max: 8 })
  })
})
