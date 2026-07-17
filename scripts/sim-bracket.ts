/*
 * Validation du moteur d'élimination « squelette + ordonnanceur » (lib/bracket).
 * On ne relit pas : on GÉNÈRE le plan, on JOUE des tournois entiers, et on
 * vérifie chaque invariant (plan, exécution, ETA). Byes forcés inclus.
 *
 * Lancer :  npx tsx scripts/sim-bracket.ts
 */
import {
  initialiserTournoi,
  onScoreSaisi,
  nourriciersDe,
  nbToursWinners,
  nextPowerOfTwo,
  refNourricier,
  type NouveauMatchDynamique,
  type Placement,
} from '../lib/bracket'
import { filtrerDemarrables, filtrerLancables, estPresent } from '../lib/demarrage'
import { calculerETA } from '../lib/eta'
import type { Equipe, Match, Tournoi } from '../lib/supabase/database.types'

const DUREE = 45
const HEURE_DEBUT = '2026-07-13T09:00:00.000Z'

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let echecs = 0
function verifier(nom: string, ok: boolean, detail: string) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${nom} — ${detail}`)
  if (!ok) echecs++
}

function fakeEquipes(n: number): Equipe[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `E${String(i + 1).padStart(2, '0')}`,
    tournoi_id: 'T',
    nom: `Eq ${i + 1}`,
    joueur1: `A${i}`,
    joueur2: `B${i}`,
    code_acces: `C${i}`,
    tete_serie: i < 4 ? i + 1 : null, // 4 têtes de série → exerce seeding + byes
    tableau: null,
    place_finale: null,
    points_fft: null,
    created_at: HEURE_DEBUT,
  }))
}

function fakeTournoi(n: number, C: number): Pick<Tournoi, 'id' | 'nb_equipes' | 'nb_terrains' | 'heure_debut' | 'duree_match_minutes' | 'categorie_fft'> {
  return { id: 'T', nb_equipes: n, nb_terrains: C, heure_debut: HEURE_DEBUT, duree_match_minutes: DUREE, categorie_fft: 'P100' }
}

const clef = (m: { tableau: string; tour: number; match_num: number }) => `${m.tableau}:${m.tour}:${m.match_num}`

function toMatch(nm: NouveauMatchDynamique): Match {
  return {
    id: clef(nm),
    tournoi_id: nm.tournoi_id,
    equipe1_id: nm.equipe1_id,
    equipe2_id: nm.equipe2_id,
    gagnant_id: nm.gagnant_id,
    terrain: nm.terrain,
    creneau: nm.creneau,
    moitie: nm.moitie,
    tour: nm.tour,
    match_num: nm.match_num,
    tableau: nm.tableau,
    places_en_jeu: nm.places_en_jeu,
    statut: nm.statut,
    equipe1_presente: false,
    equipe2_presente: false,
    score_equipe1: null,
    score_equipe2: null,
    score_equipe1_points: null,
    score_equipe2_points: null,
    est_bye: nm.est_bye,
    heure_convocation: nm.heure_convocation,
    heure_convocation_estimee: null,
    heure_debut: null,
    heure_fin: nm.statut === 'termine' ? HEURE_DEBUT : null,
    score_propose_equipe1: null,
    score_propose_equipe2: null,
    score_propose_par: null,
    statut_score: null,
    propositions_score: {},
    created_at: HEURE_DEBUT,
  }
}

// ── Invariants du PLAN (après initialiserTournoi) ───────────────────────────
function verifierPlan(n: number, C: number, plan: NouveauMatchDynamique[]) {
  const total = nextPowerOfTwo(n)
  const nbTours = nbToursWinners(total)
  const nonBye = plan.filter((m) => !m.est_bye)

  // 1a. terrain + creneau non nuls pour tout match non-bye.
  const champsOk = nonBye.every((m) => m.terrain != null && m.creneau != null)
  verifier('terrain + creneau non nuls (tout match non-bye)', champsOk, `${nonBye.length} matchs non-bye`)

  // 1b. moitie a un sens STRICTEMENT pour les winners hors finale ; NULL partout
  //     ailleurs (finale winners + toute la consolante). Cf. COMMENT ON COLUMN moitie.
  const moitieWinners = plan
    .filter((m) => m.tableau === 'winners' && m.tour < nbTours)
    .every((m) => m.moitie === 'gauche' || m.moitie === 'droite')
  const moitieNulleAilleurs = plan
    .filter((m) => m.tableau === 'consolante' || (m.tableau === 'winners' && m.tour === nbTours))
    .every((m) => m.moitie === null)
  verifier('moitie : non-null SSI winners hors finale (NULL en finale + consolante)', moitieWinners && moitieNulleAilleurs, `winners hors finale renseignés, ${plan.filter((m) => m.tableau === 'consolante' || m.tour === nbTours).length} matchs finale/consolante à NULL`)

  // 2. zéro conflit (terrain, creneau)
  const paires = new Set<string>()
  let conflit = false
  for (const m of plan) {
    const k = `${m.terrain}#${m.creneau}`
    if (paires.has(k)) conflit = true
    paires.add(k)
  }
  verifier('zéro conflit (terrain, creneau)', !conflit, `${plan.length} matchs, ${paires.size} paires (terrain,creneau) distinctes`)

  // 3. zéro doublon de libellé de nourricier
  const planParClef = new Map(plan.map((m) => [clef(m), m]))
  const terrainCounts = new Map<number, number>()
  for (const m of plan) if (m.terrain != null) terrainCounts.set(m.terrain, (terrainCounts.get(m.terrain) ?? 0) + 1)
  const ctx = { terrainCounts, nbTours }
  const labels: string[] = []
  for (const m of plan) {
    const refs = nourriciersDe(m, total)
    if (refs.length === 0) continue
    const type = m.tableau === 'consolante' && m.tour % 100 === 1 ? ('perdant' as const) : ('gagnant' as const)
    for (const r of refs) {
      const f = planParClef.get(clef(r))
      if (!f || f.est_bye) continue // bye → équipe connue, pas de libellé affiché
      labels.push(refNourricier({ tableau: f.tableau, tour: f.tour, moitie: f.moitie }, type, { creneau: f.creneau!, terrain: f.terrain! }, ctx))
    }
  }
  const doublons = labels.filter((l, i) => labels.indexOf(l) !== i)
  verifier('zéro doublon de libellé de nourricier', doublons.length === 0, `${labels.length} libellés, ${new Set(labels).size} distincts${doublons.length ? ' — DOUBLONS: ' + [...new Set(doublons)].join(' | ') : ''}`)
  // Échantillon lisible
  console.log('    ex. libellés :', [...new Set(labels)].slice(0, 6).join('  |  '))

  // 4. alternance gauche/droite : la droite d'un tour est convoquée après la gauche
  let alternanceOk = true
  for (let r = 1; r < nbTours; r++) {
    const g = plan.filter((m) => m.tableau === 'winners' && m.tour === r && m.moitie === 'gauche').map((m) => m.creneau!)
    const d = plan.filter((m) => m.tableau === 'winners' && m.tour === r && m.moitie === 'droite').map((m) => m.creneau!)
    if (g.length && d.length && Math.min(...d) <= Math.min(...g)) alternanceOk = false
  }
  verifier('alternance gauche/droite (droite convoquée après gauche)', alternanceOk, 'créneau min droite > créneau min gauche à chaque tour')

  // 5. aucune équipe de consolante n'a deux matchs sur le même créneau
  //    (vérifié à l'exécution car les équipes ne sont connues qu'en jouant —
  //    ici on prépare, la vérif réelle est dans verifierExecution).
  void C
}

// ── Jeu complet + invariants d'EXÉCUTION ────────────────────────────────────
function jouerEtVerifier(n: number, C: number, plan: NouveauMatchDynamique[], seed: number) {
  const tournoi = fakeTournoi(n, C)
  const matchs = plan.map(toMatch)
  const terrainInitial = new Map(matchs.map((m) => [m.id, m.terrain]))
  const rng = mulberry32(seed)
  const placements: Placement[] = []
  const creneauxParEquipe = new Map<string, number[]>() // équipe -> créneaux joués (conso incluse)

  let enCoursDistinct = true
  let demarreSansEquipes = false
  let terrainInactifAvecDemarrable = false
  let verrouPresenceOk = true // un démarrable sans présence n'est JAMAIS lançable
  let enCoursSansPresence = false // aucun passage en_cours sans les deux présences
  const dureeMs = DUREE * 60_000
  let now = new Date(HEURE_DEBUT).getTime()
  let iter = 0

  while (matchs.some((m) => m.statut !== 'termine' && m.est_bye === false) && iter++ < 100000) {
    const dem = filtrerDemarrables(matchs)
    const terrOccup = new Set(matchs.filter((m) => m.statut === 'en_cours' && m.terrain != null).map((m) => m.terrain))
    const demarres: Match[] = []
    for (const d of dem) {
      if (!terrOccup.has(d.terrain!)) {
        const mm = matchs.find((m) => m.id === d.id)!
        // VERROU : démarrable mais présences pas encore cochées → PAS lançable.
        if (filtrerLancables(matchs).some((x) => x.id === mm.id)) verrouPresenceOk = false
        // Le manager coche la présence des deux équipes (geste réel avant lancement).
        mm.equipe1_presente = true
        mm.equipe2_presente = true
        // Contrôle : maintenant lançable.
        if (!filtrerLancables(matchs).some((x) => x.id === mm.id)) verrouPresenceOk = false
        // Démarrage — invariant : les deux présences sont true à cet instant.
        if (!estPresent(mm)) enCoursSansPresence = true
        mm.statut = 'en_cours'
        mm.heure_debut = new Date(now).toISOString()
        terrOccup.add(mm.terrain!)
        demarres.push(mm)
      }
    }

    // INVARIANT : deux en_cours ne partagent jamais un terrain
    const terrEnCours = matchs.filter((m) => m.statut === 'en_cours').map((m) => m.terrain)
    if (new Set(terrEnCours).size !== terrEnCours.length) enCoursDistinct = false
    // INVARIANT : aucun démarré sans ses deux équipes
    if (demarres.some((m) => !m.equipe1_id || !m.equipe2_id)) demarreSansEquipes = true
    // INVARIANT : aucun terrain inactif alors qu'un match qui lui est assigné est démarrable
    const restantDem = filtrerDemarrables(matchs) // recalcul après démarrages
    for (let t = 1; t <= C; t++) {
      const occupe = matchs.some((m) => m.statut === 'en_cours' && m.terrain === t)
      if (!occupe && restantDem.some((m) => m.terrain === t)) terrainInactifAvecDemarrable = true
    }

    if (demarres.length === 0) break // garde anti-blocage

    now += dureeMs
    for (const mm of demarres) {
      // score de sets aléatoire, gagnant aléatoire parmi les 2 équipes connues
      const gagnantId = rng() < 0.5 ? mm.equipe1_id! : mm.equipe2_id!
      const res = onScoreSaisi({
        match: { ...mm },
        scoreEquipe1: '9',
        scoreEquipe2: '3',
        gagnantId,
        tousLesMatchs: matchs,
        tournoi,
      })
      // appliquer (heure_fin posée par matchMisAJour)
      const byId = new Map(matchs.map((m) => [m.id, m]))
      Object.assign(byId.get(res.matchMisAJour.id)!, res.matchMisAJour, { heure_fin: new Date(now).toISOString() })
      for (const u of res.matchsAMettreAJour) Object.assign(byId.get(u.id)!, u)
      placements.push(...res.placementsFinaux)
      // trace créneaux consolante par équipe
      if (mm.tableau === 'consolante') {
        for (const eq of [mm.equipe1_id, mm.equipe2_id]) {
          if (!eq) continue
          if (!creneauxParEquipe.has(eq)) creneauxParEquipe.set(eq, [])
          creneauxParEquipe.get(eq)!.push(mm.creneau!)
        }
      }
    }
  }

  // INVARIANT CLÉ : terrain immuable — plan initial == état final, match par match
  const terrainImmuable = matchs.every((m) => m.terrain === terrainInitial.get(m.id))
  verifier('terrain IMMUABLE (plan initial == état final, match par match)', terrainImmuable, `${matchs.length} matchs comparés`)
  verifier('deux en_cours ne partagent jamais un terrain', enCoursDistinct, 'à chaque étape de démarrage')
  verifier('aucun match démarré sans ses deux équipes', !demarreSansEquipes, 'equipe1_id & equipe2_id requis')
  verifier('aucun terrain inactif alors qu’un match assigné est démarrable', !terrainInactifAvecDemarrable, 'greedy par terrain')
  verifier('VERROU présence : un match démarrable sans présence n’est PAS lançable', verrouPresenceOk, 'filtrerLancables exige les deux présences')
  verifier('aucun passage en_cours sans les deux présences', !enCoursSansPresence, 'présence cochée avant chaque démarrage')

  // Fin : TOUT match terminé, byes ET fantômes compris → zéro match fantôme non
  // résolu (c'est le test de non-régression du bug historique des équipes disparues :
  // un slot de consolante laissé vide par un bye winners resterait en_attente à vie).
  const nonResolus = matchs.filter((m) => m.statut !== 'termine')
  verifier(
    'tous les matchs terminés (byes/fantômes inclus) — zéro fantôme non résolu',
    nonResolus.length === 0,
    `${matchs.length - nonResolus.length}/${matchs.length}${nonResolus.length ? ' — restants: ' + nonResolus.map((m) => `${m.tableau}:${m.tour}:${m.match_num}`).join(', ') : ''}`
  )

  // Toutes les équipes ont une place, aucune disparue
  const idsPlaces = new Set(placements.map((p) => p.id))
  const doublePlace = placements.length !== idsPlaces.size
  verifier('chaque équipe a exactement une place finale (zéro disparue)', idsPlaces.size === n && !doublePlace, `${idsPlaces.size}/${n} équipes placées, ${placements.length} placements`)

  // Consolante : aucune équipe deux matchs sur le même créneau
  let consoDoubleCreneau = false
  let enchaineSansRepos = false
  for (const [, crs] of creneauxParEquipe) {
    if (new Set(crs).size !== crs.length) consoDoubleCreneau = true
    const tri = [...crs].sort((a, b) => a - b)
    for (let i = 1; i < tri.length; i++) if (tri[i] === tri[i - 1] + 1) enchaineSansRepos = true
  }
  verifier('aucune équipe de consolante n’a deux matchs sur le même créneau', !consoDoubleCreneau, 'créneaux distincts par équipe en consolante')
  if (enchaineSansRepos) console.log('    ⚠ note : au moins une équipe de consolante enchaîne deux créneaux consécutifs (comblement) — acceptable, à signaler.')

  return { matchs, tournoi }
}

// ── Invariants ETA ──────────────────────────────────────────────────────────
function verifierETA(n: number, matchs: Match[], tournoi: Pick<Tournoi, 'duree_match_minutes' | 'nb_equipes'>) {
  const total = nextPowerOfTwo(n)
  const dureeMs = tournoi.duree_match_minutes * 60_000

  // On repart d'un état FRAIS mi-tournoi : rejouer le plan et s'arrêter à ~40%.
  // (Ici on reconstruit un état partiel pour tester l'ETA sur des matchs à venir.)
  // Plus simple : on prend le plan initial (rien joué) et un "maintenant".
  // -> fait par l'appelant qui nous passe un état partiel. Ici on teste sur
  //    l'état fourni.
  const maintenant = new Date(HEURE_DEBUT)
  const eta = calculerETA({ duree_match_minutes: tournoi.duree_match_minutes, nb_equipes: n }, matchs, maintenant)

  const now = maintenant.getTime()
  let auncunPasse = true
  let depOk = true
  const finEstimee = new Map<string, number>()
  for (const m of matchs) {
    if (m.statut === 'termine') finEstimee.set(m.id, m.heure_fin ? new Date(m.heure_fin).getTime() : now)
    if (m.statut === 'en_cours' && m.heure_debut) finEstimee.set(m.id, Math.max(new Date(m.heure_debut).getTime() + dureeMs, now))
  }
  for (const [id, d] of eta) {
    if (d.getTime() < now - 1) auncunPasse = false
    finEstimee.set(id, d.getTime() + dureeMs)
  }
  for (const [id, d] of eta) {
    const m = matchs.find((x) => x.id === id)!
    for (const r of nourriciersDe(m, total)) {
      const f = matchs.find((x) => x.tableau === r.tableau && x.tour === r.tour && x.match_num === r.match_num)
      if (f && finEstimee.has(f.id) && d.getTime() < finEstimee.get(f.id)! - 1) depOk = false
    }
  }
  verifier('aucune ETA antérieure à maintenant', auncunPasse, `${eta.size} ETA calculées`)
  verifier('ETA ≥ fin estimée des deux nourriciers', depOk, 'contrainte de dépendance respectée')
}

// ── Scénario de retard ──────────────────────────────────────────────────────
function verifierRetard(n: number, C: number) {
  const tournoi = fakeTournoi(n, C)
  const plan = initialiserTournoi(tournoi, fakeEquipes(n)).matchs
  const matchs = plan.map(toMatch)
  const total = nextPowerOfTwo(n)

  // Démarrer les matchs du 1er créneau (créneau min) sur leurs terrains.
  const creneauMin = Math.min(...matchs.filter((m) => !m.est_bye).map((m) => m.creneau!))
  const premiers = matchs.filter((m) => m.creneau === creneauMin && !m.est_bye)
  const t0 = new Date(HEURE_DEBUT).getTime()
  for (const m of premiers) {
    m.statut = 'en_cours'
    m.heure_debut = new Date(t0).toISOString()
  }
  const terrainAvant = new Map(matchs.map((m) => [m.id, m.terrain]))

  const maintenant = new Date(t0 + DUREE * 60_000) // pile à la fin prévue
  const etaNormale = calculerETA({ duree_match_minutes: DUREE, nb_equipes: n }, matchs, maintenant)

  // Retard : un des matchs en cours dure le double (on avance "maintenant" au-delà)
  const maintenantRetard = new Date(t0 + 2 * DUREE * 60_000) // le match déborde encore
  const etaRetard = calculerETA({ duree_match_minutes: DUREE, nb_equipes: n }, matchs, maintenantRetard)

  // Les ETA des matchs suivants doivent se décaler (≥) sous retard.
  let decalage = true
  let auMoinsUnDecale = false
  for (const [id, dNorm] of etaNormale) {
    const dRet = etaRetard.get(id)
    if (!dRet) continue
    if (dRet.getTime() < dNorm.getTime() - 1) decalage = false
    if (dRet.getTime() > dNorm.getTime() + 1) auMoinsUnDecale = true
  }
  const terrainInchange = matchs.every((m) => m.terrain === terrainAvant.get(m.id))
  verifier('retard : les ETA suivantes se décalent (≥), au moins une strictement', decalage && auMoinsUnDecale, 'un match doublant sa durée repousse les suivants')
  verifier('retard : aucun terrain ne change', terrainInchange, 'le temps est élastique, pas le terrain')
  void total
}

// ── Run ─────────────────────────────────────────────────────────────────────
const CONFIGS: [number, number][] = [
  [8, 2],
  [11, 3], // tordue : total 16, 5 byes → beaucoup de byes/fantômes en consolante
  [13, 4],
  [16, 4],
  [16, 6], // plus de terrains que nécessaire (sous-charge)
  [24, 6], // bonus : 8 byes
  [32, 6],
]

for (const [n, C] of CONFIGS) {
  console.log(`\n================ ÉLIMINATION — ${n} équipes / ${C} terrains ================`)
  const plan = initialiserTournoi(fakeTournoi(n, C), fakeEquipes(n)).matchs
  console.log(`  ${plan.length} matchs générés (winners + consolante), ${plan.filter((m) => m.est_bye).length} byes`)
  verifierPlan(n, C, plan)
  const { matchs, tournoi } = jouerEtVerifier(n, C, plan, 1000 + n)
  // ETA sur un état frais (rien joué) pour tester dépendances + pas de passé
  verifierETA(n, initialiserTournoi(fakeTournoi(n, C), fakeEquipes(n)).matchs.map(toMatch), { duree_match_minutes: DUREE, nb_equipes: n })
  verifierRetard(n, C)
  void matchs
  void tournoi
}

console.log(`\n================ RÉSULTAT GLOBAL BRACKET ================`)
if (echecs === 0) console.log('  ✓ Toutes les vérifications sont PASS.')
else console.log(`  ✗ ${echecs} vérification(s) en échec.`)
process.exit(echecs === 0 ? 0 : 1)
