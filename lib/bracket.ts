import { randomInt } from 'crypto'
import type { Equipe, Match, Tableau, Tournoi } from './supabase/database.types'
import { getPoints } from './fft'

// ============================================================================
// Moteur d'élimination — fonctions PURES (aucun accès Supabase).
//
// MODÈLE « squelette complet + ordonnanceur » (0006) :
//   - initialiserTournoi génère TOUT le tableau (winners + toutes les vagues de
//     consolante) d'un coup, équipes à NULL là où inconnues, et attribue à
//     chaque match son `terrain`, `creneau`, `moitie` de façon DÉTERMINISTE.
//   - Le terrain est PLANIFIÉ et IMMUABLE : il n'est jamais réassigné ensuite.
//     `onScoreSaisi` ne crée plus de match et n'écrit plus jamais de terrain —
//     il remplit les slots existants et pose les placements finaux.
//
// Le moteur de VAGUES indépendantes (chaque tour de perdants = mini-bracket
// autonome), les placements FFT + ex-æquo, le seeding et les byes sont
// PRÉSERVÉS — seule la planification (terrain/creneau/moitie) est nouvelle.
// ============================================================================

// ----------------------------------------------------------------------------
// Utilitaires de base
// ----------------------------------------------------------------------------

export function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

export function getNbByes(nbEquipes: number): number {
  return nextPowerOfTwo(nbEquipes) - nbEquipes
}

const CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateCodeAcces(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARSET[randomInt(CODE_CHARSET.length)]
  return code
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ----------------------------------------------------------------------------
// Placement des équipes dans le tableau (têtes de série + reste + byes)
// ----------------------------------------------------------------------------

/**
 * Positions canoniques (têtes de série) + distribution DÉTERMINISTE des byes :
 * chaque bye est placé dans une paire distincte du tour 1, en priorité face aux
 * têtes de série (positions paires 0, total/2, …), pour qu'aucune paire n'ait
 * deux byes (ce qui produirait un match sans aucune équipe). Les positions des
 * têtes de série ne changent pas.
 */
function buildSlots(equipes: Equipe[], total: number): (string | null)[] {
  const slots: (string | null)[] = new Array(total).fill(null)
  const seedPositions = [0, total / 2, total / 4, (3 * total) / 4]

  const seeded = equipes
    .filter((e) => e.tete_serie != null)
    .sort((a, b) => (a.tete_serie ?? 0) - (b.tete_serie ?? 0))
    .slice(0, 4)
  seeded.forEach((equipe, i) => {
    slots[seedPositions[i]] = equipe.id
  })
  const seededIds = new Set(seeded.map((e) => e.id))
  const reste = shuffle(equipes.filter((e) => !seededIds.has(e.id)))

  const nbByes = total - equipes.length

  // Cases « adverses » des paires du tour 1 (le slot impair de chaque paire),
  // ordonnées pour donner un bye d'abord aux paires des têtes de série. Les byes
  // = ces slots qu'on laisse vides ; on garantit ≤ 1 bye par paire.
  const nbPaires = total / 2
  const ordrePaires: number[] = []
  // paires des têtes de série d'abord (position paire → son partenaire impair)
  for (const p of seedPositions) if (p % 2 === 0) ordrePaires.push(p + 1)
  // puis les autres paires, dans l'ordre
  for (let i = 0; i < nbPaires; i++) {
    const slotImpair = 2 * i + 1
    if (!ordrePaires.includes(slotImpair)) ordrePaires.push(slotImpair)
  }
  const byeSlots = new Set(ordrePaires.slice(0, nbByes))

  // Remplir toutes les cases non-seed et non-bye avec le reste des équipes.
  let idx = 0
  for (let s = 0; s < total; s++) {
    if (slots[s] !== null) continue // tête de série déjà placée
    if (byeSlots.has(s)) continue // laissé vide = bye
    slots[s] = reste[idx++]?.id ?? null
  }
  return slots
}

// ----------------------------------------------------------------------------
// Modèle de vagues (consolante) — PRÉSERVÉ tel quel
// ----------------------------------------------------------------------------

export function nbToursWinners(total: number): number {
  return Math.log2(total)
}
function tailleVague(waveR: number, total: number): number {
  return total / 2 ** waveR
}
function bandeDebutVague(waveR: number, total: number): number {
  return total / 2 ** waveR + 1
}
function tailleGroupeSousVague(waveR: number, subTour: number, total: number): number {
  return tailleVague(waveR, total) / 2 ** (subTour - 1)
}
function estFinaleDeVague(waveR: number, subTour: number, total: number): boolean {
  return tailleGroupeSousVague(waveR, subTour, total) === 2
}
function placePerdantSousVague(waveR: number, subTour: number, total: number): number {
  return bandeDebutVague(waveR, total) - 1 + tailleGroupeSousVague(waveR, subTour, total)
}
function encoderTourVague(waveR: number, subTour: number): number {
  return waveR * 100 + subTour
}
function decoderVague(tourEncode: number): { waveR: number; subTour: number } {
  return { waveR: Math.floor(tourEncode / 100), subTour: tourEncode % 100 }
}
function libellePlacesVague(waveR: number, total: number): string {
  const debut = bandeDebutVague(waveR, total)
  const taille = tailleVague(waveR, total)
  return `Places ${debut}-${debut + taille - 1}`
}

interface SlotCible {
  match_num: number
  slot: 'equipe1_id' | 'equipe2_id'
}
/** Avancement standard (winners, et interne à une vague de consolante). */
function slotSuivant(matchNumActuel: number): SlotCible {
  return {
    match_num: Math.ceil(matchNumActuel / 2),
    slot: matchNumActuel % 2 === 1 ? 'equipe1_id' : 'equipe2_id',
  }
}

// ----------------------------------------------------------------------------
// Squelette + ordonnanceur
// ----------------------------------------------------------------------------

export interface NouveauMatchDynamique {
  tournoi_id: string
  equipe1_id: string | null
  equipe2_id: string | null
  gagnant_id: string | null
  terrain: number | null
  creneau: number | null
  moitie: 'gauche' | 'droite' | null
  tour: number
  match_num: number
  tableau: Tableau
  places_en_jeu: string
  statut: 'en_attente' | 'termine'
  equipe1_presente: boolean
  equipe2_presente: boolean
  est_bye: boolean
  heure_convocation: string | null
}

type TypeNourricier = 'gagnant' | 'perdant'
interface RefMatch {
  tableau: Tableau
  tour: number
  match_num: number
}
interface MatchSquelette {
  tableau: Tableau
  tour: number
  match_num: number
  moitie: 'gauche' | 'droite' | null
  places_en_jeu: string
  /** Les 2 matchs dont les issues remplissent ce match (null pour winners tour 1). */
  nourriciers: [RefMatch & { type: TypeNourricier }, RefMatch & { type: TypeNourricier }] | null
}

function cle(r: { tableau: Tableau; tour: number; match_num: number }): string {
  return `${r.tableau}:${r.tour}:${r.match_num}`
}

/**
 * Les 2 matchs nourriciers d'un match (mêmes règles que le squelette). Sert à
 * l'ETA (contrainte de dépendance) et aux libellés. `[]` pour le tour 1 winners.
 */
export function nourriciersDe(
  ref: { tableau: Tableau | null; tour: number; match_num: number },
  _total: number
): RefMatch[] {
  const m = ref.match_num
  if (ref.tableau !== 'winners' && ref.tableau !== 'consolante') return [] // team americano : pas de bracket
  if (ref.tableau === 'winners') {
    if (ref.tour === 1) return []
    return [
      { tableau: 'winners', tour: ref.tour - 1, match_num: 2 * m - 1 },
      { tableau: 'winners', tour: ref.tour - 1, match_num: 2 * m },
    ]
  }
  const { waveR, subTour } = decoderVague(ref.tour)
  if (subTour === 1) {
    return [
      { tableau: 'winners', tour: waveR, match_num: 2 * m - 1 },
      { tableau: 'winners', tour: waveR, match_num: 2 * m },
    ]
  }
  return [
    { tableau: 'consolante', tour: encoderTourVague(waveR, subTour - 1), match_num: 2 * m - 1 },
    { tableau: 'consolante', tour: encoderTourVague(waveR, subTour - 1), match_num: 2 * m },
  ]
}

/** Génère tous les matchs (winners + vagues consolante) avec leur graphe de nourriciers. */
function genererSquelette(total: number): MatchSquelette[] {
  const nbTours = nbToursWinners(total)
  const out: MatchSquelette[] = []

  // Winners
  for (let r = 1; r <= nbTours; r++) {
    const nb = total / 2 ** r
    for (let m = 1; m <= nb; m++) {
      const moitie = r === nbTours ? null : m <= nb / 2 ? 'gauche' : 'droite'
      const nourriciers =
        r === 1
          ? null
          : ([
              { tableau: 'winners' as const, tour: r - 1, match_num: 2 * m - 1, type: 'gagnant' as const },
              { tableau: 'winners' as const, tour: r - 1, match_num: 2 * m, type: 'gagnant' as const },
            ] as MatchSquelette['nourriciers'])
      out.push({
        tableau: 'winners',
        tour: r,
        match_num: m,
        moitie,
        places_en_jeu: `Places 1-${total / 2 ** (r - 1)}`,
        nourriciers,
      })
    }
  }

  // Consolante — une vague par tour winners R (1..nbTours-1), mini-bracket propre
  for (let waveR = 1; waveR <= nbTours - 1; waveR++) {
    const places = libellePlacesVague(waveR, total)
    let subTour = 1
    let groupe = tailleVague(waveR, total)
    while (groupe >= 2) {
      const nbM = groupe / 2
      for (let m = 1; m <= nbM; m++) {
        const nourriciers: MatchSquelette['nourriciers'] =
          subTour === 1
            ? [
                { tableau: 'winners', tour: waveR, match_num: 2 * m - 1, type: 'perdant' },
                { tableau: 'winners', tour: waveR, match_num: 2 * m, type: 'perdant' },
              ]
            : [
                { tableau: 'consolante', tour: encoderTourVague(waveR, subTour - 1), match_num: 2 * m - 1, type: 'gagnant' },
                { tableau: 'consolante', tour: encoderTourVague(waveR, subTour - 1), match_num: 2 * m, type: 'gagnant' },
              ]
        out.push({
          tableau: 'consolante',
          tour: encoderTourVague(waveR, subTour),
          match_num: m,
          moitie: null,
          places_en_jeu: places,
          nourriciers,
        })
      }
      groupe = groupe / 2
      subTour++
    }
  }
  return out
}

export interface PlanMatch {
  creneau: number
  terrain: number
}

/**
 * Ordonnanceur DÉTERMINISTE : attribue (creneau, terrain) à chaque match.
 * Terrain = préférence « terrain min des nourriciers » (d'où l'affichage
 * « T1 : V-T1 vs V-T2 »), sinon prochain terrain libre du créneau (débordement).
 * Consolante = comble les terrains laissés libres par les phases winners.
 * Garantit : jamais deux matchs sur (terrain, creneau) identique.
 */
function planifier(squelette: MatchSquelette[], total: number, nbTerrains: number): Map<string, PlanMatch> {
  const C = Math.max(1, nbTerrains)
  const nbTours = nbToursWinners(total)
  const assign = new Map<string, PlanMatch>()
  const usage = new Map<number, Set<number>>()
  const use = (cr: number, t: number) => {
    if (!usage.has(cr)) usage.set(cr, new Set())
    usage.get(cr)!.add(t)
  }
  const terrainLibre = (cr: number, pref: number): number => {
    const u = usage.get(cr) ?? new Set<number>()
    if (!u.has(pref)) return pref
    for (let t = 1; t <= C; t++) if (!u.has(t)) return t
    return pref // ne devrait jamais arriver (≤ C par créneau)
  }

  const parCle = new Map(squelette.map((m) => [cle(m), m]))
  const terrainDe = (r: RefMatch) => assign.get(cle(r))!.terrain
  const creneauDe = (r: RefMatch) => assign.get(cle(r))!.creneau

  // ── Étape A : grille winners (phases gauche/droite alternées) ──────────────
  const phases: { matches: MatchSquelette[]; round: number }[] = []
  for (let r = 1; r <= nbTours; r++) {
    const winnersR = squelette
      .filter((x) => x.tableau === 'winners' && x.tour === r)
      .sort((a, b) => a.match_num - b.match_num)
    if (r === nbTours) {
      phases.push({ matches: winnersR, round: r }) // finale
    } else {
      const nb = winnersR.length
      phases.push({ matches: winnersR.filter((x) => x.match_num <= nb / 2), round: r }) // gauche
      phases.push({ matches: winnersR.filter((x) => x.match_num > nb / 2), round: r }) // droite
    }
  }

  let creneauCourant = 1
  for (const phase of phases) {
    phase.matches.forEach((m, idx) => {
      const creneau = creneauCourant + Math.floor(idx / C)
      let pref: number
      if (phase.round === 1) {
        pref = (idx % C) + 1
      } else {
        const [f1, f2] = m.nourriciers!
        pref = Math.min(terrainDe(f1), terrainDe(f2))
      }
      const terrain = terrainLibre(creneau, pref)
      assign.set(cle(m), { creneau, terrain })
      use(creneau, terrain)
    })
    creneauCourant += Math.ceil(phase.matches.length / C)
  }

  // ── Étape B : comblement consolante (vague, sous-tour, match_num) ──────────
  const conso = squelette
    .filter((x) => x.tableau === 'consolante')
    .sort((a, b) => {
      const A = decoderVague(a.tour)
      const B = decoderVague(b.tour)
      return A.waveR - B.waveR || A.subTour - B.subTour || a.match_num - b.match_num
    })
  for (const m of conso) {
    const [f1, f2] = m.nourriciers!
    const ready = 1 + Math.max(creneauDe(f1), creneauDe(f2))
    const pref = Math.min(terrainDe(f1), terrainDe(f2))
    let creneau = ready
    while ((usage.get(creneau)?.size ?? 0) >= C) creneau++
    const terrain = terrainLibre(creneau, pref)
    assign.set(cle(m), { creneau, terrain })
    use(creneau, terrain)
  }

  void parCle
  return assign
}

// ----------------------------------------------------------------------------
// Libellés de nourriciers (affichage écran public / joueur)
// ----------------------------------------------------------------------------

export interface RefNourricierCtx {
  /** terrain -> nombre de matchs sur ce terrain (pour savoir si le suffixe créneau est requis). */
  terrainCounts: Map<number, number>
  /** dernier tour winners (pour reconnaître les demi-finales). */
  nbTours: number
}

/**
 * Libellé d'un slot inconnu, référençant son match nourricier. Invariant :
 * deux nourriciers distincts ne rendent JAMAIS le même libellé.
 *  - demi-finale winners → « Vainqueur demi-gauche/droite » (cas spécial finale)
 *  - sinon « Vainqueur|Perdant T{t} », suffixé « · créneau {c} » dès que le
 *    terrain seul n'identifie pas le match (≥ 2 matchs sur ce terrain).
 */
export function refNourricier(
  feeder: { tableau: Tableau; tour: number; moitie: 'gauche' | 'droite' | null },
  type: TypeNourricier,
  plan: PlanMatch,
  ctx: RefNourricierCtx
): string {
  const verbe = type === 'gagnant' ? 'Vainqueur' : 'Perdant'
  // Demi-finale winners nourrissant la finale : libellé par moitié.
  if (feeder.tableau === 'winners' && feeder.tour === ctx.nbTours - 1 && feeder.moitie) {
    return `${verbe} demi-${feeder.moitie}`
  }
  const t = plan.terrain
  const ambigu = (ctx.terrainCounts.get(t) ?? 0) > 1
  return ambigu ? `${verbe} T${t} · créneau ${plan.creneau}` : `${verbe} T${t}`
}

// ----------------------------------------------------------------------------
// Initialisation — génère TOUT le tableau planifié
// ----------------------------------------------------------------------------

export interface InitialiserTournoiResult {
  matchs: NouveauMatchDynamique[]
  equipesTableau: { id: string; tableau: 'winners' }[]
}

export function initialiserTournoi(
  tournoi: Pick<Tournoi, 'id' | 'nb_equipes' | 'nb_terrains' | 'heure_debut' | 'duree_match_minutes'>,
  equipes: Equipe[]
): InitialiserTournoiResult {
  const total = nextPowerOfTwo(tournoi.nb_equipes)
  const nbTours = nbToursWinners(total)
  const slots = buildSlots(equipes, total)
  const squelette = genererSquelette(total)
  const plan = planifier(squelette, total, tournoi.nb_terrains)

  const heureDebut = new Date(tournoi.heure_debut).getTime()
  const convocation = (creneau: number) =>
    new Date(heureDebut + (creneau - 1) * tournoi.duree_match_minutes * 60_000).toISOString()

  // Slots d'équipes : on remplit le tour 1, puis on propage les byes d'un cran.
  const equipeSlots = new Map<string, { equipe1_id: string | null; equipe2_id: string | null }>()
  const estByeMatch = new Set<string>()
  const gagnantBye = new Map<string, string>() // cle match tour1 -> gagnant (bye)

  for (const m of squelette) equipeSlots.set(cle(m), { equipe1_id: null, equipe2_id: null })

  for (let m = 1; m <= total / 2; m++) {
    const k = cle({ tableau: 'winners', tour: 1, match_num: m })
    const e1 = slots[2 * (m - 1)] ?? null
    const e2 = slots[2 * (m - 1) + 1] ?? null
    equipeSlots.set(k, { equipe1_id: e1, equipe2_id: e2 })
    const unSeul = (e1 === null) !== (e2 === null)
    if (unSeul) {
      estByeMatch.add(k)
      const gagnant = (e1 ?? e2)!
      gagnantBye.set(k, gagnant)
      // Propager le gagnant du bye dans son match du tour 2.
      const cible = slotSuivant(m)
      const kCible = cle({ tableau: 'winners', tour: 2, match_num: cible.match_num })
      const cur = equipeSlots.get(kCible)!
      equipeSlots.set(kCible, { ...cur, [cible.slot]: gagnant })
    }
  }

  // BYES EN CONSOLANTE. Un match winners tour 1 en bye ne produit pas de perdant
  // → certains slots de la vague 1 ne recevront jamais d'équipe. On les traite
  // comme des byes (le pendant EXACT des byes winners, un cran plus bas), sans
  // jamais collapser l'arbre : chaque match du squelette existe toujours, on ne
  // fait que boucher le trou sur place. Classement de la vague 1 (SEULE concernée :
  // seul le tour 1 winners a des byes) par nombre de nourriciers vivants :
  //   0 → FANTÔME  : aucune équipe n'y entrera → est_bye + terminé d'emblée, aucune place.
  //   1 → BYE      : une seule équipe le traversera → est_bye + EN ATTENTE ; quand
  //                  l'équipe réelle arrive, onScoreSaisi la fait avancer direct au
  //                  sous-tour suivant (aucun match joué, aucun terrain/créneau consommé).
  //   2 → match normal.
  const consoFantome = new Set<string>() // 0 nourricier vivant
  const consoBye = new Set<string>() // 1 nourricier vivant
  {
    const perdantDispo = (j: number) => !estByeMatch.has(cle({ tableau: 'winners', tour: 1, match_num: j }))
    const vivant = new Map<string, boolean>()
    let groupe = tailleVague(1, total)
    let subTour = 1
    while (groupe >= 2) {
      const nbM = groupe / 2
      for (let m = 1; m <= nbM; m++) {
        const k = cle({ tableau: 'consolante', tour: encoderTourVague(1, subTour), match_num: m })
        const alim =
          subTour === 1
            ? (perdantDispo(2 * m - 1) ? 1 : 0) + (perdantDispo(2 * m) ? 1 : 0)
            : (vivant.get(cle({ tableau: 'consolante', tour: encoderTourVague(1, subTour - 1), match_num: 2 * m - 1 })) ? 1 : 0) +
              (vivant.get(cle({ tableau: 'consolante', tour: encoderTourVague(1, subTour - 1), match_num: 2 * m })) ? 1 : 0)
        vivant.set(k, alim >= 1) // un fantôme ne produit rien ; un bye produit son unique équipe
        if (alim === 0) consoFantome.add(k)
        else if (alim === 1) consoBye.add(k)
      }
      groupe = groupe / 2
      subTour++
    }
  }

  const matchs: NouveauMatchDynamique[] = squelette.map((sq) => {
    const k = cle(sq)
    const p = plan.get(k)!
    const eq = equipeSlots.get(k)!
    const estByeW = estByeMatch.has(k) // bye winners (équipe connue → gagnant + terminé)
    const estBye = estByeW || consoFantome.has(k) || consoBye.has(k) // bye dans les 3 cas
    // Terminé d'emblée SEULEMENT si l'issue est déjà connue : bye winners (gagnant
    // connu) ou fantôme (aucune équipe). Le bye consolante reste en_attente : il se
    // termine quand l'équipe réelle le traverse (onScoreSaisi).
    const termineDEmblee = estByeW || consoFantome.has(k)
    return {
      tournoi_id: tournoi.id,
      equipe1_id: eq.equipe1_id,
      equipe2_id: eq.equipe2_id,
      gagnant_id: estByeW ? gagnantBye.get(k)! : null,
      terrain: p.terrain,
      creneau: p.creneau,
      moitie: sq.moitie,
      tour: sq.tour,
      match_num: sq.match_num,
      tableau: sq.tableau,
      places_en_jeu: sq.places_en_jeu,
      statut: termineDEmblee ? 'termine' : 'en_attente',
      equipe1_presente: false,
      equipe2_presente: false,
      est_bye: estBye, // un bye ne consomme ni terrain ni créneau (exclu de filtrerDemarrables + calculerETA)
      heure_convocation: estBye ? null : convocation(p.creneau),
    }
  })

  void nbTours
  return {
    matchs,
    equipesTableau: equipes.map((e) => ({ id: e.id, tableau: 'winners' as const })),
  }
}

// ----------------------------------------------------------------------------
// Progression — un score vient d'être validé.
//
// Contrats : NE CRÉE JAMAIS de match (le squelette est complet dès l'init), NE
// TOUCHE JAMAIS au terrain (immuable) — il ne fait que remplir des slots
// existants, résoudre les byes et produire des placements.
//
// RÈGLE DES BYES EN CONSOLANTE (le point délicat). Un bye au tour 1 des winners
// produit un « perdant qui n'existe pas » : le slot de consolante correspondant
// resterait vide à vie → match jamais résolu, équipe disparue (le bug historique).
// On le traite comme un BYE, pas comme une équipe fantôme : le match à une seule
// équipe est marqué est_bye à l'init et, quand l'équipe réelle l'atteint, `deposer`
// la fait avancer DIRECTEMENT au sous-tour suivant sans jouer (récursif). Choix du
// bye plutôt que du walkover parce que (1) il réutilise le mécanisme déjà validé
// des byes winners, (2) un bye est exclu de filtrerDemarrables ET de calculerETA,
// donc il ne consomme ni terrain ni créneau réel — un walkover, lui, aurait réservé
// un créneau pour un match jamais joué. Les vagues restent indépendantes : on bouche
// un trou dans le mini-bracket, on ne change pas le modèle. (Init : voir consoBye /
// consoFantome dans initialiserTournoi.)
// ----------------------------------------------------------------------------

export interface ScoreSaisiInput {
  match: Match
  scoreEquipe1: string
  scoreEquipe2: string
  gagnantId: string
  tousLesMatchs: Match[]
  tournoi: Pick<Tournoi, 'nb_equipes' | 'categorie_fft'>
}

export interface Placement {
  id: string
  place_finale: number
  points_fft: number | null
}

export interface ScoreSaisiResult {
  matchMisAJour: Partial<Match> & { id: string }
  /** Slots d'équipes à renseigner dans des matchs DÉJÀ existants. */
  matchsAMettreAJour: Array<Partial<Match> & { id: string }>
  placementsFinaux: Placement[]
  tournoiTermine: boolean
}

export function onScoreSaisi(input: ScoreSaisiInput): ScoreSaisiResult {
  const { match, scoreEquipe1, scoreEquipe2, gagnantId, tousLesMatchs, tournoi } = input
  const perdantId = gagnantId === match.equipe1_id ? match.equipe2_id : match.equipe1_id
  const total = nextPowerOfTwo(tournoi.nb_equipes)
  const dernierTourWinners = nbToursWinners(total)

  const matchMisAJour: ScoreSaisiResult['matchMisAJour'] = {
    id: match.id,
    score_equipe1: scoreEquipe1,
    score_equipe2: scoreEquipe2,
    gagnant_id: gagnantId,
    statut: 'termine',
    heure_fin: new Date().toISOString(),
  }
  const matchsAMettreAJour: ScoreSaisiResult['matchsAMettreAJour'] = []
  const placementsFinaux: Placement[] = []

  const finaleWinners = match.tableau === 'winners' && match.tour === dernierTourWinners
  const { waveR, subTour } =
    match.tableau === 'consolante' ? decoderVague(match.tour) : { waveR: 0, subTour: 0 }
  const finaleDeVague = match.tableau === 'consolante' && estFinaleDeVague(waveR, subTour, total)

  const trouver = (ref: RefMatch) =>
    tousLesMatchs.find((m) => m.tableau === ref.tableau && m.tour === ref.tour && m.match_num === ref.match_num)

  // Dépose une équipe dans un slot existant (on remplit, on ne crée jamais). Si la
  // cible est un BYE de consolante (est_bye posé à l'init : son slot d'en face ne
  // recevra jamais d'équipe), l'équipe ne joue pas : elle est déclarée gagnante et
  // avance directement au sous-tour suivant (récursif — le suivant peut aussi être
  // un bye), ou remporte la vague par forfait si c'est la finale de vague. C'est le
  // pendant EXACT du bye winners, un cran plus bas ; slotSuivant est inchangé (la
  // topologie reste fixe, seul le fait de jouer change).
  const deposer = (ref: RefMatch, slot: 'equipe1_id' | 'equipe2_id', equipeId: string) => {
    const cible = trouver(ref)
    if (!cible) return
    if (cible.tableau === 'consolante' && cible.est_bye === true) {
      const { waveR: wR, subTour: sT } = decoderVague(cible.tour)
      matchsAMettreAJour.push({ id: cible.id, [slot]: equipeId, statut: 'termine', gagnant_id: equipeId } as Partial<Match> & { id: string })
      if (estFinaleDeVague(wR, sT, total)) {
        const place = bandeDebutVague(wR, total)
        placementsFinaux.push({ id: equipeId, place_finale: place, points_fft: getPoints(tournoi.categorie_fft, tournoi.nb_equipes, place) })
      } else {
        const suiv = slotSuivant(cible.match_num)
        deposer({ tableau: 'consolante', tour: encoderTourVague(wR, sT + 1), match_num: suiv.match_num }, suiv.slot, equipeId)
      }
      return
    }
    matchsAMettreAJour.push({ id: cible.id, [slot]: equipeId } as Partial<Match> & { id: string })
  }

  // 1. Avancer le gagnant dans le slot existant (sauf finale winners / de vague).
  if (!finaleWinners && !finaleDeVague) {
    const cible = slotSuivant(match.match_num)
    if (match.tableau === 'winners') {
      deposer({ tableau: 'winners', tour: match.tour + 1, match_num: cible.match_num }, cible.slot, gagnantId)
    } else {
      deposer(
        { tableau: 'consolante', tour: encoderTourVague(waveR, subTour + 1), match_num: cible.match_num },
        cible.slot,
        gagnantId
      )
    }
  }

  // 2. Perdant (et gagnant si finale) : placement(s) définitif(s).
  if (finaleWinners) {
    placementsFinaux.push({
      id: gagnantId,
      place_finale: 1,
      points_fft: getPoints(tournoi.categorie_fft, tournoi.nb_equipes, 1),
    })
    if (perdantId) {
      placementsFinaux.push({
        id: perdantId,
        place_finale: 2,
        points_fft: getPoints(tournoi.categorie_fft, tournoi.nb_equipes, 2),
      })
    }
  } else if (match.tableau === 'winners' && perdantId) {
    // Le perdant winners tombe dans SA vague (tour R), sous-tour 1.
    const cibleMatchNum = Math.ceil(match.match_num / 2)
    const slot = match.match_num % 2 === 1 ? 'equipe1_id' : 'equipe2_id'
    deposer(
      { tableau: 'consolante', tour: encoderTourVague(match.tour, 1), match_num: cibleMatchNum },
      slot,
      perdantId
    )
  } else if (match.tableau === 'consolante' && perdantId) {
    const placePerdant = placePerdantSousVague(waveR, subTour, total)
    placementsFinaux.push({
      id: perdantId,
      place_finale: placePerdant,
      points_fft: getPoints(tournoi.categorie_fft, tournoi.nb_equipes, placePerdant),
    })
    if (finaleDeVague) {
      const placeGagnant = bandeDebutVague(waveR, total)
      placementsFinaux.push({
        id: gagnantId,
        place_finale: placeGagnant,
        points_fft: getPoints(tournoi.categorie_fft, tournoi.nb_equipes, placeGagnant),
      })
    }
  }

  const matchsRestants = tousLesMatchs.filter((m) => m.id !== match.id && m.statut !== 'termine')
  const tournoiTermine = matchsRestants.length === 0

  return { matchMisAJour, matchsAMettreAJour, placementsFinaux, tournoiTermine }
}
