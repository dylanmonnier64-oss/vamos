'use server'

import { createClient } from '@/lib/supabase/server'
import { construireMajDepuisScore } from '@/lib/progression'
import { parseScoreSets } from '@/lib/score'
import { recalculerETA } from '@/lib/eta'
import type { Match, Tournoi } from '@/lib/supabase/database.types'

// ============================================================================
// Proposition de score par un joueur (espace /t, anon). Passe par la RPC
// proposer_score (SECURITY DEFINER, 0008) ; si le score est confirmé (les deux
// équipes d'accord), déclenche la progression (onScoreSaisi en TS → RPC
// progresser_bracket) puis le recalcul d'ETA. Logique 100% TS, RPC = persistance.
// ============================================================================

type Retour = { error?: string; statut?: string }

export async function proposerScore(
  tournoiId: string,
  matchId: string,
  code: string,
  scoreEquipe1: string,
  scoreEquipe2: string
): Promise<Retour> {
  // Valide AVANT la RPC : un score invalide (égalité de sets, format…) ne doit
  // jamais pouvoir être confirmé côté base (proposer_score ne juge pas la validité
  // padel, il ne compare que des chaînes).
  const check = parseScoreSets(scoreEquipe1, scoreEquipe2)
  if (!check.valide) return { error: check.raison ?? 'Score invalide.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('proposer_score', {
    p_match_id: matchId,
    p_code_acces: code,
    p_score_equipe1: scoreEquipe1,
    p_score_equipe2: scoreEquipe2,
  })
  if (error) return { error: error.message }

  const res = data as { statut_score: string; confirme: boolean } | null
  if (res?.confirme) {
    const [{ data: tournoi }, { data: matchsData }] = await Promise.all([
      supabase.from('tournois').select('nb_equipes, categorie_fft').eq('id', tournoiId).single(),
      supabase.from('matchs').select('*').eq('tournoi_id', tournoiId),
    ])
    if (tournoi && matchsData) {
      const maj = construireMajDepuisScore(
        matchsData as Match[],
        tournoi as Pick<Tournoi, 'nb_equipes' | 'categorie_fft'>,
        matchId,
        scoreEquipe1,
        scoreEquipe2
      )
      if (!('erreur' in maj)) {
        await supabase.rpc('progresser_bracket', { p_match_id: matchId, p_code_acces: code, p_maj: maj.maj })
        await recalculerETA(tournoiId)
      }
    }
  }
  return { statut: res?.statut_score }
}
