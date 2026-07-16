'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { construireMajDepuisScore } from '@/lib/progression'
import { recalculerETA } from '@/lib/eta'
import { filtrerDemarrables } from '@/lib/demarrage'
import type { Match, Tournoi } from '@/lib/supabase/database.types'

// ============================================================================
// Server actions de la page manager /live. Le manager est authentifié : la RLS
// l'autorise à écrire directement dans matchs/equipes/tournois — pas besoin des
// RPC SECURITY DEFINER (réservées au flux joueur anon). La logique de
// progression reste 100 % dans lib/bracket.ts via construireMajDepuisScore.
// ============================================================================

type Retour = { error?: string }

async function exigerManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/manager/login')
  return supabase
}

/**
 * Valide un score (saisie directe OU arbitrage d'un conteste : le manager passe
 * simplement le score retenu). Écrit le score confirmé, fait avancer le tableau
 * (onScoreSaisi) et recalcule l'ETA.
 */
export async function validerScoreManager(
  tournoiId: string,
  matchId: string,
  scoreEquipe1: string,
  scoreEquipe2: string
): Promise<Retour> {
  const supabase = await exigerManager()

  const [{ data: tournoi }, { data: matchsData }] = await Promise.all([
    supabase.from('tournois').select('*').eq('id', tournoiId).single<Tournoi>(),
    supabase.from('matchs').select('*').eq('tournoi_id', tournoiId),
  ])
  if (!tournoi || !matchsData) return { error: 'Tournoi introuvable.' }
  const matchs = matchsData as Match[]

  const r = construireMajDepuisScore(matchs, tournoi, matchId, scoreEquipe1, scoreEquipe2)
  if ('erreur' in r) return { error: r.erreur }

  // Applique le diff (RLS manager). Le terrain n'est JAMAIS dans le diff.
  for (const m of r.maj.matchs) {
    const { id, ...champs } = m
    // Sur le match arbitré : score entériné + propositions purgées.
    const extra =
      id === matchId
        ? { statut_score: 'confirme' as const, propositions_score: {} }
        : {}
    const { error } = await supabase.from('matchs').update({ ...champs, ...extra }).eq('id', id)
    if (error) return { error: `Écriture du match : ${error.message}` }
  }
  for (const e of r.maj.equipes) {
    const { error } = await supabase
      .from('equipes')
      .update({ place_finale: e.place_finale, points_fft: e.points_fft })
      .eq('id', e.id)
    if (error) return { error: `Écriture d'un placement : ${error.message}` }
  }
  if (r.maj.tournoi_termine) {
    await supabase.from('tournois').update({ statut: 'termine' }).eq('id', tournoiId).eq('statut', 'en_cours')
  }

  await recalculerETA(tournoiId)
  revalidatePath(`/manager/tournoi/${tournoiId}/live`)
  return {}
}

/**
 * Lance un match depuis la page manager. Vérifie côté serveur qu'il est bien
 * démarrable (terrain libre, deux équipes connues) — la même garantie que la
 * RPC demarrer_match côté joueur, mais via la RLS manager.
 */
export async function demarrerMatchManager(tournoiId: string, matchId: string): Promise<Retour> {
  const supabase = await exigerManager()

  const { data: tournoi } = await supabase.from('tournois').select('statut').eq('id', tournoiId).single()
  if (!tournoi || tournoi.statut !== 'en_cours') {
    return { error: "Le tournoi n'est pas en cours." }
  }
  const { data: matchsData } = await supabase.from('matchs').select('*').eq('tournoi_id', tournoiId)
  const matchs = (matchsData ?? []) as Match[]

  if (!filtrerDemarrables(matchs).some((m) => m.id === matchId)) {
    return { error: 'Ce match ne peut pas démarrer (terrain occupé ou équipes inconnues).' }
  }

  const { error } = await supabase
    .from('matchs')
    .update({ statut: 'en_cours', heure_debut: new Date().toISOString() })
    .eq('id', matchId)
    .in('statut', ['en_attente', 'equipes_presentes'])
  if (error) return { error: error.message }

  await recalculerETA(tournoiId)
  revalidatePath(`/manager/tournoi/${tournoiId}/live`)
  return {}
}

/** Coche/décoche la présence d'une équipe. Booléen informatif — ne change PAS
 *  le statut (le match reste démarrable, cf. filtrerDemarrables). */
export async function cocherPresence(
  tournoiId: string,
  matchId: string,
  cote: 1 | 2,
  present: boolean
): Promise<Retour> {
  const supabase = await exigerManager()
  const col = cote === 1 ? 'equipe1_presente' : 'equipe2_presente'
  const { error } = await supabase.from('matchs').update({ [col]: present }).eq('id', matchId)
  if (error) return { error: error.message }
  revalidatePath(`/manager/tournoi/${tournoiId}/live`)
  return {}
}
