import { describe, test, expect } from 'vitest'
import { construireMajDepuisScore } from '../lib/progression'
import { bracketInitial } from './helpers'

describe('construireMajDepuisScore', () => {
  test('9-3 → vainqueur avance en winners tour 2, perdant en consolante, terrain jamais écrit', () => {
    const { tournoi, matchs } = bracketInitial(8, 2)
    const m = matchs.find((x) => x.tableau === 'winners' && x.tour === 1 && x.match_num === 1 && !x.est_bye)!
    const r = construireMajDepuisScore(matchs, tournoi, m.id, '9', '3')
    expect('maj' in r).toBe(true)
    if (!('maj' in r)) return

    // score 9-3 → équipe 1 gagne
    expect(r.gagnantId).toBe(m.equipe1_id)
    const perdant = m.equipe2_id

    // le terrain n'est JAMAIS dans le diff (immuable)
    expect(r.maj.matchs.every((u) => !('terrain' in u))).toBe(true)

    // le vainqueur atterrit dans un match winners tour 2
    const versWinners2 = r.maj.matchs.some(
      (u) => u.id.startsWith('winners:2:') && (u.equipe1_id === r.gagnantId || u.equipe2_id === r.gagnantId)
    )
    expect(versWinners2).toBe(true)

    // le perdant atterrit en consolante
    const versConso = r.maj.matchs.some(
      (u) => u.id.startsWith('consolante:') && (u.equipe1_id === perdant || u.equipe2_id === perdant)
    )
    expect(versConso).toBe(true)
  })

  test('score invalide → erreur, aucun diff', () => {
    const { tournoi, matchs } = bracketInitial(8, 2)
    const m = matchs.find((x) => x.tableau === 'winners' && x.tour === 1 && !x.est_bye)!
    const r = construireMajDepuisScore(matchs, tournoi, m.id, '5', '3') // set incomplet
    expect('erreur' in r).toBe(true)
  })
})
