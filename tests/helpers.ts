import { initialiserTournoi, type NouveauMatchDynamique } from '../lib/bracket'
import type { Equipe, Match, Tournoi } from '../lib/supabase/database.types'

// Données de test partagées pour les tests de moteur (bracket/eta/progression/
// libelles). Miroir des helpers de scripts/sim-bracket.ts.

export const HEURE = '2026-07-14T09:00:00.000Z'

export function fakeEquipes(n: number): Equipe[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `E${String(i + 1).padStart(2, '0')}`,
    tournoi_id: 'T',
    nom: `Eq ${i + 1}`,
    joueur1: `A${i}`,
    joueur2: `B${i}`,
    code_acces: `C${i}`,
    tete_serie: i < 4 ? i + 1 : null, // 4 têtes → exerce seeding + byes
    tableau: null,
    place_finale: null,
    points_fft: null,
    created_at: HEURE,
  }))
}

export function fakeTournoi(
  n: number,
  C: number
): Pick<Tournoi, 'id' | 'nb_equipes' | 'nb_terrains' | 'heure_debut' | 'duree_match_minutes' | 'categorie_fft'> {
  return { id: 'T', nb_equipes: n, nb_terrains: C, heure_debut: HEURE, duree_match_minutes: 45, categorie_fft: 'P100' }
}

const clef = (m: { tableau: string; tour: number; match_num: number }) => `${m.tableau}:${m.tour}:${m.match_num}`

export function toMatch(nm: NouveauMatchDynamique): Match {
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
    heure_fin: nm.statut === 'termine' ? HEURE : null,
    score_propose_equipe1: null,
    score_propose_equipe2: null,
    score_propose_par: null,
    statut_score: null,
    propositions_score: {},
    created_at: HEURE,
  }
}

/** Plan initial d'un tournoi élimination : matchs (état frais) + le tournoi. */
export function bracketInitial(n: number, C: number) {
  const tournoi = fakeTournoi(n, C)
  const plan = initialiserTournoi(tournoi, fakeEquipes(n)).matchs
  return { tournoi, plan, matchs: plan.map(toMatch) }
}
