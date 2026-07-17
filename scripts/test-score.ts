// Tests unitaires de lib/score.ts — format élimination = UN set à 9 jeux (« 9-3 »).
// Exécutés via tsx ; portés sous Vitest en phase 5. Valides ET invalides.
import { parseScoreSets, parseSaisieCombinee, formatScoreSets } from '../lib/score'

let ok = 0
let ko = 0
function check(nom: string, cond: boolean, detail = '') {
  if (cond) { ok++; console.log(`  [PASS] ${nom}`) }
  else { ko++; console.log(`  [FAIL] ${nom} ${detail}`) }
}

console.log('================ lib/score — un set à 9 jeux ================')

// ── Valides ────────────────────────────────────────────────────────────────
let r = parseScoreSets('9', '3')
check('9-3 → valide, équipe 1 gagne', r.valide && r.gagnant === 1 && r.jeuxEquipe1 === 9 && r.jeuxEquipe2 === 3, JSON.stringify(r))

r = parseScoreSets('3', '9')
check('3-9 → valide, équipe 2 gagne', r.valide && r.gagnant === 2, JSON.stringify(r))

r = parseScoreSets('9', '8')
check('9-8 (mort subite) → valide', r.valide && r.gagnant === 1, JSON.stringify(r))

r = parseScoreSets('10', '8')
check('10-8 (2 jeux d’écart) → valide', r.valide && r.gagnant === 1, JSON.stringify(r))

r = parseScoreSets('9', '0')
check('9-0 → valide', r.valide && r.gagnant === 1, JSON.stringify(r))

// ── Invalides ──────────────────────────────────────────────────────────────
r = parseScoreSets('5', '3')
check('5-3 → rejeté (set incomplet, vainqueur < 9)', !r.valide && /incomplet/i.test(r.raison ?? ''), JSON.stringify(r))

r = parseScoreSets('9', '9')
check('9-9 → rejeté (pas de vainqueur)', !r.valide && /vainqueur/i.test(r.raison ?? ''), JSON.stringify(r))

r = parseScoreSets('6 6', '4 3')
check('6-4 6-3 (multi-set) → rejeté (un seul set attendu)', !r.valide && /un seul set/i.test(r.raison ?? ''), JSON.stringify(r))

r = parseScoreSets('', '')
check('score vide → rejeté', !r.valide, JSON.stringify(r))

r = parseScoreSets('9', 'abc')
check('non entier → rejeté (format)', !r.valide && /format/i.test(r.raison ?? ''), JSON.stringify(r))

r = parseScoreSets('9-3', '3')
check('tiret dans une colonne → rejeté (format)', !r.valide, JSON.stringify(r))

r = parseScoreSets('-9', '3')
check('négatif → rejeté (format)', !r.valide, JSON.stringify(r))

// ── parseSaisieCombinee (saisie « 9-3 » → deux colonnes) ─────────────────────
check('parseSaisieCombinee("9-3") = {9, 3}', JSON.stringify(parseSaisieCombinee('9-3')) === JSON.stringify({ s1: '9', s2: '3' }))
check('parseSaisieCombinee("9 3") sans tiret → null', parseSaisieCombinee('9 3') === null)
check('parseSaisieCombinee("") → null', parseSaisieCombinee('') === null)

// ── formatScoreSets ──────────────────────────────────────────────────────────
check('formatScoreSets("9","3") = "9-3"', formatScoreSets('9', '3') === '9-3', formatScoreSets('9', '3'))
check('formatScoreSets(null,null) = ""', formatScoreSets(null, null) === '')

console.log('================ RÉSULTAT ================')
console.log(ko === 0 ? `  ✓ ${ok} tests PASS` : `  ✗ ${ko} FAIL / ${ok + ko}`)
process.exit(ko === 0 ? 0 : 1)
