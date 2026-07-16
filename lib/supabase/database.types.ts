// Types écrits à la main pour correspondre aux migrations supabase/ (0001 init,
// 0002 rename organisations, 0003 americano). À remplacer par
// `supabase gen types typescript` un jour — garder synchronisé en attendant.

export type Plan = 'trial' | 'per_tournament' | 'monthly'
export type RoleUser = 'admin' | 'manager'
export type CategorieFft = 'P25' | 'P50' | 'P100' | 'P250' | 'P500' | 'P1000' | 'P1500'
export type StatutTournoi = 'setup' | 'en_cours' | 'termine'
export type Tableau = 'winners' | 'consolante'
export type StatutMatch = 'en_attente' | 'equipes_presentes' | 'en_cours' | 'termine'
export type StatutScore = 'propose' | 'confirme' | 'conteste'

// 0003 — format de tournoi. 'elimination' = paires fixes (equipes/matchs,
// moteur bracket) ; 'americano'/'mexicano' = inscription individuelle
// (participants/matchs_americano, moteur americano). team-americano/mixicano
// restent hors enum tant qu'ils ne sont pas construits.
export type FormatTournoi = 'elimination' | 'americano' | 'mexicano' | 'team_americano'
export type StatutParticipant = 'actif' | 'abandon'
export type StatutMatchAmericano = 'en_attente' | 'equipes_presentes' | 'en_cours' | 'termine'

export interface Organisation {
  id: string
  nom: string
  email: string
  plan: Plan
  tournois_gratuits_restants: number
  actif: boolean
  created_at: string
}

export interface UserRow {
  id: string
  organisation_id: string
  role: RoleUser
}

export interface Tournoi {
  id: string
  organisation_id: string
  nom: string
  date: string
  format: FormatTournoi
  // NB : en base (0003) ces deux colonnes sont NULLABLE — un tournoi
  // americano/mexicano les laisse NULL. On les garde typées non-null ici parce
  // que tout le format élimination (lib/bracket.ts, intouchable) les suppose
  // présentes, ce qui est toujours vrai pour un tournoi 'elimination'. Dette
  // assumée : le code qui lit un tournoi americano ne doit pas s'appuyer sur
  // ces champs (il utilise format / points_par_match / nb_participants).
  categorie_fft: CategorieFft
  nb_equipes: number
  nb_terrains: number
  heure_debut: string
  duree_match_minutes: number
  statut: StatutTournoi
  // 0003 — renseignés uniquement pour format 'americano' / 'mexicano'.
  points_par_match: number | null
  nb_rounds: number | null
  nb_participants: number | null
  // 0009 — masque le bloc « points indicatifs » côté joueur si false (défaut true).
  afficher_points_indicatifs: boolean
  created_at: string
}

export interface Equipe {
  id: string
  tournoi_id: string
  nom: string
  joueur1: string
  joueur2: string
  code_acces: string
  tete_serie: number | null
  tableau: Tableau | null
  place_finale: number | null
  points_fft: number | null
  created_at: string
}

/** Équipe sans `code_acces` — c'est ce que voient /tableau et /t/[code]. */
export type EquipePublic = Omit<Equipe, 'code_acces'>

export interface Match {
  id: string
  tournoi_id: string
  equipe1_id: string | null
  equipe2_id: string | null
  gagnant_id: string | null
  terrain: number | null
  // ⚠️ `tour` a 3 sens selon le contexte (winners / consolante encodée /
  // round-robin team americano) — ne jamais le lire sans discriminer
  // tableau/format d'abord (cf. COMMENT ON COLUMN, migration 0004).
  tour: number
  match_num: number
  // Nullable depuis 0004 : NULL pour un match team americano (pas de bracket).
  tableau: Tableau | null
  places_en_jeu: string | null
  // 0006 — planification (format elimination uniquement, NULL sinon). `creneau`
  // est DISTINCT de `tour` (cf. COMMENT ON COLUMN). `moitie` NULL pour la finale.
  creneau: number | null
  moitie: 'gauche' | 'droite' | null
  statut: StatutMatch
  equipe1_presente: boolean
  equipe2_presente: boolean
  // Élimination : scores de sets en texte ("6-4 6-3").
  score_equipe1: string | null
  score_equipe2: string | null
  // 0004 — team americano : scores en points (int). NULL en élimination.
  score_equipe1_points: number | null
  score_equipe2_points: number | null
  est_bye: boolean
  // Convocation initiale FIGÉE (planification). heure_convocation_estimee (0007)
  // est l'ETA recalculée en live ; seule cette dernière bouge.
  heure_convocation: string | null
  heure_convocation_estimee: string | null
  heure_debut: string | null
  heure_fin: string | null
  score_propose_equipe1: string | null
  score_propose_equipe2: string | null
  score_propose_par: string | null
  statut_score: StatutScore | null
  // 0008 — propositions de score en cours, par équipe :
  // { equipe_id: { e1: string, e2: string } }. statut_score en dérive
  // (1 entrée = propose, 2 égales = confirme, 2 différentes = conteste).
  propositions_score: Record<string, { e1: string; e2: string }>
  created_at: string
}

export interface NoteJoueur {
  id: string
  code_acces: string
  equipe_ciblee_id: string
  contenu: string
  created_at: string
}

// ── 0003 — americano / mexicano ────────────────────────────────────────────

/** Joueur individuel inscrit à un tournoi americano/mexicano (pas une paire). */
export interface Participant {
  id: string
  tournoi_id: string
  nom: string
  code_acces: string
  /** Niveau déclaré (optionnel) — sert au seed du round 1 mexicano. */
  niveau: number | null
  statut: StatutParticipant
  created_at: string
}

/** Participant sans `code_acces` — ce que voient /tableau et /t/[code]. */
export type ParticipantPublic = Omit<Participant, 'code_acces'>

/** Un match americano = toujours 4 participants (2 v 2), scores en points. */
export interface MatchAmericano {
  id: string
  tournoi_id: string
  round: number
  terrain: number | null
  equipe_a_j1: string
  equipe_a_j2: string
  equipe_b_j1: string
  equipe_b_j2: string
  score_a: number | null
  score_b: number | null
  statut: StatutMatchAmericano
  heure_convocation: string | null
  heure_debut: string | null
  heure_fin: string | null
  created_at: string
}
