// Tests unitaires de lib/score.ts (exécutés via tsx ; portés sous Vitest en
// phase 5). Couvre les scores valides ET invalides.
import { parseScoreSets, formatScoreSets } from '../lib/score'

let ok = 0
let ko = 0
function check(nom: string, cond: boolean, detail = '') {
  if (cond) {
    ok++
    console.log(`  [PASS] ${nom}`)
  } else {
    ko++
    console.log(`  [FAIL] ${nom} ${detail}`)
  }
}

console.log('================ lib/score — parseScoreSets ================')

// ── Valides ────────────────────────────────────────────────────────────────
let r = parseScoreSets('6 6', '4 3')
check('6-4 6-3 → valide, équipe 1 gagne 2-0', r.valide && r.gagnant === 1 && r.setsEquipe1 === 2 && r.setsEquipe2 === 0, JSON.stringify(r))

r = parseScoreSets('4 3', '6 6')
check('4-6 3-6 → valide, équipe 2 gagne 2-0', r.valide && r.gagnant === 2 && r.setsEquipe2 === 2, JSON.stringify(r))

r = parseScoreSets('6 4 10', '4 6 8')
check('3 sets (super tie-break) → valide, équipe 1 gagne 2-1', r.valide && r.gagnant === 1 && r.setsEquipe1 === 2 && r.setsEquipe2 === 1, JSON.stringify(r))

r = parseScoreSets('7 6', '5 7')
check('7-5 6-7 → set gagné chacun mais... invalide (égalité de sets)', !r.valide, JSON.stringify(r))

r = parseScoreSets('7 6 7', '5 7 6')
check('7-5 6-7 7-6 → valide, équipe 1 gagne 2-1', r.valide && r.gagnant === 1, JSON.stringify(r))

// ── Invalides ──────────────────────────────────────────────────────────────
r = parseScoreSets('6 6', '4')
check('nombre de sets différent → rejeté', !r.valide && /sets différent/i.test(r.raison ?? ''), JSON.stringify(r))

r = parseScoreSets('', '')
check('score vide → rejeté', !r.valide, JSON.stringify(r))

r = parseScoreSets('0 0', '0 0')
check('tout à zéro → rejeté (score nul / set sans vainqueur)', !r.valide, JSON.stringify(r))

r = parseScoreSets('6 6', '6 3')
check('set 1 égal (6-6) → rejeté (set sans vainqueur)', !r.valide && /vainqueur/i.test(r.raison ?? ''), JSON.stringify(r))

r = parseScoreSets('6 4', '4 6')
check('un set chacun (6-4 4-6) → rejeté (égalité de sets)', !r.valide && /gali/i.test(r.raison ?? ''), JSON.stringify(r))

r = parseScoreSets('6 abc', '4 3')
check('non entier → rejeté (format)', !r.valide && /format/i.test(r.raison ?? ''), JSON.stringify(r))

r = parseScoreSets('6,4', '4,6')
check('séparateur virgule (pas d\'espace) → rejeté (format)', !r.valide, JSON.stringify(r))

r = parseScoreSets('-6 3', '4 6')
check('nombre négatif → rejeté (format)', !r.valide, JSON.stringify(r))

// ── formatScoreSets ──────────────────────────────────────────────────────────
check('formatScoreSets("6 6","4 3") = "6-4, 6-3"', formatScoreSets('6 6', '4 3') === '6-4, 6-3', formatScoreSets('6 6', '4 3'))
check('formatScoreSets(null,null) = ""', formatScoreSets(null, null) === '')

console.log('================ RÉSULTAT ================')
console.log(ko === 0 ? `  ✓ ${ok} tests PASS` : `  ✗ ${ko} FAIL / ${ok + ko}`)
process.exit(ko === 0 ? 0 : 1)
