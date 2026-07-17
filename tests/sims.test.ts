import { describe, test, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

// Les simulations valident les invariants LOURDS (impossible à réduire à un
// assert court) : bracket sur 6 configs (terrain immuable du début à la fin,
// zéro conflit, zéro doublon, zéro équipe sans place, verrou présence, ETA), et
// la non-régression americano / team-americano. Chaque sim sort en code 1 si un
// invariant casse → execFileSync lève, le test échoue. Rejouées via npm test.
function runSim(script: string) {
  execFileSync('npx', ['tsx', `scripts/${script}`], { stdio: 'pipe' })
}

describe('sims — invariants complets + non-régression', () => {
  test('sim-bracket : 6 configs (plan + exécution + ETA + verrou présence)', () => {
    expect(() => runSim('sim-bracket.ts')).not.toThrow()
  }, 60_000)

  test('sim-americano : non-régression', () => {
    expect(() => runSim('sim-americano.ts')).not.toThrow()
  }, 60_000)

  test('sim-team-americano : non-régression', () => {
    expect(() => runSim('sim-team-americano.ts')).not.toThrow()
  }, 60_000)
})
