'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { filtrerLancables } from '@/lib/demarrage'
import { recalculerETA } from '@/lib/eta'
import type { Match } from '@/lib/supabase/database.types'

// ============================================================================
// Page de check-in (présence par ÉQUIPE). La présence est stockée par match
// (matchs.equipe1_presente / equipe2_presente) — cocher une équipe la marque
// présente sur SON prochain match en attente. Un match ne devient lançable que
// si ses DEUX équipes sont présentes (filtrerLancables), garantie côté serveur
// ici ET côté SQL par demarrer_match (0010).
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

/** Prochain match en attente (non-bye) d'une équipe, le plus petit créneau. */
function prochainMatch(matchs: Match[], equipeId: string): Match | undefined {
  return matchs
    .filter((m) => (m.equipe1_id === equipeId || m.equipe2_id === equipeId) && m.statut === 'en_attente' && !m.est_bye)
    .sort((a, b) => (a.creneau ?? 0) - (b.creneau ?? 0))[0]
}

/** Coche/décoche la présence d'une équipe sur son prochain match. */
export async function checkinEquipe(tournoiId: string, equipeId: string, present: boolean): Promise<Retour> {
  const supabase = await exigerManager()
  const { data } = await supabase.from('matchs').select('*').eq('tournoi_id', tournoiId)
  const matchs = (data ?? []) as Match[]
  const m = prochainMatch(matchs, equipeId)
  if (!m) return { error: 'Aucun match à venir pour cette équipe.' }
  const col = m.equipe1_id === equipeId ? 'equipe1_presente' : 'equipe2_presente'
  const { error } = await supabase.from('matchs').update({ [col]: present }).eq('id', m.id)
  if (error) return { error: error.message }
  revalidatePath(`/manager/tournoi/${tournoiId}/checkin`)
  return {}
}

/** Lance un match depuis la page check-in — exige qu'il soit lançable (les deux
 *  présences + terrain libre), même garantie que /live. */
export async function demarrerDepuisCheckin(tournoiId: string, matchId: string): Promise<Retour> {
  const supabase = await exigerManager()
  const { data: tournoi } = await supabase.from('tournois').select('statut').eq('id', tournoiId).single()
  if (!tournoi || tournoi.statut !== 'en_cours') return { error: "Le tournoi n'est pas en cours." }
  const { data } = await supabase.from('matchs').select('*').eq('tournoi_id', tournoiId)
  const matchs = (data ?? []) as Match[]
  if (!filtrerLancables(matchs).some((m) => m.id === matchId)) {
    return { error: 'Match non lançable (présence ou terrain).' }
  }
  const { error } = await supabase
    .from('matchs')
    .update({ statut: 'en_cours', heure_debut: new Date().toISOString() })
    .eq('id', matchId)
    .in('statut', ['en_attente', 'equipes_presentes'])
  if (error) return { error: error.message }
  await recalculerETA(tournoiId)
  revalidatePath(`/manager/tournoi/${tournoiId}/checkin`)
  return {}
}
