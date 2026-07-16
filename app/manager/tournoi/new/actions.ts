'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateCodeAcces, initialiserTournoi } from '@/lib/bracket'
import { genererRoundRobin } from '@/lib/team-americano'
import { parseEquipes, type EquipeSaisie } from '@/lib/equipes'
import type { CategorieFft } from '@/lib/supabase/database.types'

/** Formats proposés au stepper (americano/mexicano individuels restent de côté). */
export type FormatStepper = 'elimination' | 'team_americano'

export interface CreerTournoiInput {
  nom: string
  date: string // yyyy-mm-dd
  heure: string // HH:mm
  format: FormatStepper
  /** Élimination uniquement. */
  categorie_fft: CategorieFft | null
  /** Team americano uniquement : points cible par match (16/20/24/32). */
  points_par_match: number | null
  /** Team americano : plafond de rounds du round-robin (null = complet). */
  nb_rounds: number | null
  nb_terrains: number
  duree_match_minutes: number
  /** Texte brut du textarea — conservé pour la validation défensive des lignes. */
  equipesTexte: string
  /**
   * Liste finale des paires telle qu'affichée dans le stepper (après
   * d'éventuels échanges de joueurs entre paires). C'est CETTE liste qui fait
   * foi pour la création — pas un re-parsing du texte, sinon les échanges
   * faits en UI seraient perdus.
   */
  equipes: EquipeSaisie[]
  /** index dans la liste (ordre affiché) -> rang de tête de série (1-4) */
  tetesDeSerie: Record<number, number>
  /** Élimination : affiche ou non les points indicatifs côté joueur (défaut true). */
  afficher_points_indicatifs?: boolean
}

/**
 * Crée le tournoi + les équipes + génère le tour 1 (via lib/bracket.ts),
 * dans cet ordre — avec rattrapage manuel si une étape échoue après la
 * précédente (Supabase-js n'a pas de transaction multi-tables côté client).
 * Redirige vers la page bracket pour review avant "Lancer le tournoi".
 */
export async function creerTournoi(input: CreerTournoiInput) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/manager/login')
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('organisation_id')
    .eq('id', user.id)
    .single()

  if (!userRow) {
    throw new Error("Ce compte n'est rattaché à aucun club.")
  }

  if (!input.nom.trim()) {
    throw new Error('Le nom du tournoi est obligatoire.')
  }
  if (!input.date) {
    throw new Error('La date du tournoi est obligatoire.')
  }

  const { lignesInvalides } = parseEquipes(input.equipesTexte)
  if (lignesInvalides.length > 0) {
    throw new Error(`Format invalide sur : "${lignesInvalides[0]}". Attendu : Joueur1 / Joueur2.`)
  }

  // La liste affichée (post-échanges) fait foi. On la valide défensivement :
  // le client bloque déjà "Suivant" en amont, mais l'action serveur ne doit
  // jamais faire confiance aveuglément à son input.
  const equipesFinales = input.equipes
  if (!Array.isArray(equipesFinales) || equipesFinales.length < 2) {
    throw new Error('Il faut au moins 2 équipes pour créer un tournoi.')
  }
  for (const e of equipesFinales) {
    if (!e.joueur1?.trim() || !e.joueur2?.trim()) {
      throw new Error('Chaque équipe doit comporter deux joueurs nommés.')
    }
  }

  const heureDebut = new Date(`${input.date}T${input.heure}:00`)
  if (Number.isNaN(heureDebut.getTime())) {
    throw new Error('Date ou heure de début invalide.')
  }

  const estTeam = input.format === 'team_americano'

  const { data: tournoi, error: tournoiError } = await supabase
    .from('tournois')
    .insert({
      organisation_id: userRow.organisation_id,
      nom: input.nom.trim(),
      date: input.date,
      format: input.format,
      // Élimination : catégorie FFT. Team americano : points cible + rounds.
      categorie_fft: estTeam ? null : input.categorie_fft,
      points_par_match: estTeam ? input.points_par_match : null,
      nb_rounds: estTeam ? input.nb_rounds : null,
      nb_equipes: equipesFinales.length,
      nb_terrains: input.nb_terrains,
      heure_debut: heureDebut.toISOString(),
      duree_match_minutes: input.duree_match_minutes,
      // Élimination : points indicatifs visibles côté joueur (défaut true).
      afficher_points_indicatifs: estTeam ? true : input.afficher_points_indicatifs ?? true,
      // Les deux formats démarrent en 'setup' : le manager confirme le
      // lancement (bracket pour l'élim., /planning pour le team americano) →
      // statut passe à 'en_cours' et les matchs deviennent démarrables.
      statut: 'setup',
    })
    .select()
    .single()

  if (tournoiError || !tournoi) {
    throw new Error(`Impossible de créer le tournoi : ${tournoiError?.message ?? 'erreur inconnue'}`)
  }

  const equipesAInserer = equipesFinales.map((e, i) => ({
    tournoi_id: tournoi.id,
    nom: `${e.joueur1.trim()} / ${e.joueur2.trim()}`,
    joueur1: e.joueur1.trim(),
    joueur2: e.joueur2.trim(),
    code_acces: generateCodeAcces(),
    tete_serie: input.tetesDeSerie[i] ?? null,
  }))

  const { data: equipesInserees, error: equipesError } = await supabase
    .from('equipes')
    .insert(equipesAInserer)
    .select()

  if (equipesError || !equipesInserees) {
    // Rattrapage : le tournoi a été créé mais les équipes ont échoué (ex :
    // collision improbable sur code_acces unique). On nettoie plutôt que de
    // laisser un tournoi orphelin en statut 'setup' sans aucune équipe.
    await supabase.from('tournois').delete().eq('id', tournoi.id)
    throw new Error(
      `Impossible de créer les équipes : ${equipesError?.message ?? 'erreur inconnue'}. Réessaie.`
    )
  }

  // ── Team americano : round-robin généré d'emblée ────────────────────────
  if (estTeam) {
    const sched = genererRoundRobin(
      equipesInserees.map((e) => e.id),
      tournoi.nb_terrains,
      tournoi.nb_rounds ?? undefined
    )
    const matchsRR = sched.matchs.map((m) => ({
      tournoi_id: tournoi.id,
      equipe1_id: m.equipe1,
      equipe2_id: m.equipe2,
      terrain: m.terrain,
      tour: m.round, // round-robin (tableau IS NULL → cf. commentaire migration)
      match_num: m.matchNum,
      tableau: null,
      statut: 'en_attente' as const,
      est_bye: false,
    }))
    const { error: rrError } = await supabase.from('matchs').insert(matchsRR)
    if (rrError) {
      throw new Error(
        `Tournoi et paires créés, mais la génération des matchs a échoué : ${rrError.message}.`
      )
    }
    // Revue manager avant lancement (planning + codes + bouton "Lancer").
    redirect(`/manager/tournoi/${tournoi.id}/planning`)
  }

  // ── Élimination : tour 1 via lib/bracket.ts ─────────────────────────────
  const { matchs, equipesTableau } = initialiserTournoi(
    {
      id: tournoi.id,
      nb_equipes: tournoi.nb_equipes,
      nb_terrains: tournoi.nb_terrains,
      heure_debut: tournoi.heure_debut,
      duree_match_minutes: tournoi.duree_match_minutes,
    },
    equipesInserees
  )

  const { error: matchsError } = await supabase.from('matchs').insert(matchs)
  if (matchsError) {
    // Le tournoi et les équipes existent déjà à ce stade : on ne les
    // supprime pas (perte de code_acces déjà potentiellement communiqués),
    // on remonte l'erreur pour un retry manuel depuis la page bracket.
    throw new Error(
      `Tournoi et équipes créés, mais le tour 1 a échoué : ${matchsError.message}. ` +
        `Réessaie la génération depuis la page bracket du tournoi.`
    )
  }

  await supabase
    .from('equipes')
    .update({ tableau: 'winners' })
    .in(
      'id',
      equipesTableau.map((e) => e.id)
    )

  redirect(`/manager/tournoi/${tournoi.id}/bracket`)
}
