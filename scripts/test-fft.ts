// Tests de lib/fft.ts — fourchettePoints (bloc « points indicatifs » /t).
import { fourchettePoints, getPoints } from '../lib/fft'

let ok = 0
let ko = 0
function check(nom: string, cond: boolean, detail = '') {
  if (cond) { ok++; console.log(`  [PASS] ${nom}`) }
  else { ko++; console.log(`  [FAIL] ${nom}  ${detail}`) }
}

console.log('================ lib/fft — fourchettePoints ================')

// Places 1-8 sur un P100 à 8 équipes : de 1 (8e) à 100 (1er).
let f = fourchettePoints('Places 1-8', 'P100', 8)
check('P100/8 « Places 1-8 » → {1, 100}', f?.min === 1 && f?.max === 100, JSON.stringify(f))

// Bande haute 1-4 : 40..100.
f = fourchettePoints('Places 1-4', 'P100', 8)
check('P100/8 « Places 1-4 » → {40, 100}', f?.min === 40 && f?.max === 100, JSON.stringify(f))

// Bande consolante 5-8 : 1..25.
f = fourchettePoints('Places 5-8', 'P100', 8)
check('P100/8 « Places 5-8 » → {1, 25}', f?.min === 1 && f?.max === 25, JSON.stringify(f))

// Places au-delà de la tranche (9-16 pour un tableau à 8) : ignorées, borné à 1-8.
f = fourchettePoints('Places 1-16', 'P100', 8)
check('P100/8 « Places 1-16 » → borné {1,100} (places 9-16 inexistantes)', f?.min === 1 && f?.max === 100, JSON.stringify(f))

// P1000 : barème absent (erreur doc FFT) → null → bloc masqué.
f = fourchettePoints('Places 1-8', 'P1000', 8)
check('P1000 → null (bloc masqué, jamais « null points »)', f === null, JSON.stringify(f))
check('getPoints P1000 → null (cohérent)', getPoints('P1000', 8, 1) === null)

// Entrées invalides.
check('places_en_jeu null → null', fourchettePoints(null, 'P100', 8) === null)
check('places_en_jeu vide → null', fourchettePoints('', 'P100', 8) === null)
check('places_en_jeu sans nombres → null', fourchettePoints('Finale', 'P100', 8) === null)

// Un autre barème (P25/16 équipes, bande 9-16).
f = fourchettePoints('Places 9-16', 'P25', 16)
check('P25/16 « Places 9-16 » → {1, 8}', f?.min === 1 && f?.max === 8, JSON.stringify(f))

console.log('================ RÉSULTAT ================')
console.log(ko === 0 ? `  ✓ ${ok} tests PASS` : `  ✗ ${ko} FAIL / ${ok + ko}`)
process.exit(ko === 0 ? 0 : 1)
