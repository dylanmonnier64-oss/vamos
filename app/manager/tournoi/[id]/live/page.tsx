import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { nextPowerOfTwo } from '@/lib/bracket'
import { libellesFeeders } from '@/lib/libelles'
import type { Equipe, Match, StatutTournoi, Tournoi } from '@/lib/supabase/database.types'
import LiveManager from './LiveManager'

export const metadata: Metadata = {
  title: 'VAMOS · Suivi en direct',
}

export default async function LivePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/manager/login')
  }

  const { data: tournoi } = await supabase
    .from('tournois')
    .select('*')
    .eq('id', params.id)
    .single<Tournoi>()
  if (!tournoi) {
    notFound()
  }

  const [{ data: equipesData }, { data: matchsData }] = await Promise.all([
    supabase.from('equipes').select('*').eq('tournoi_id', params.id),
    supabase.from('matchs').select('*').eq('tournoi_id', params.id),
  ])
  const equipes = (equipesData ?? []) as Equipe[]
  const matchs = (matchsData ?? []) as Match[]

  const total = nextPowerOfTwo(tournoi.nb_equipes ?? 0)
  const feeders = libellesFeeders(matchs, total)

  const equipeInfos: Record<string, { nom: string; tete_serie: number | null }> = {}
  for (const e of equipes) equipeInfos[e.id] = { nom: e.nom, tete_serie: e.tete_serie }

  const libelles: Record<string, { e1: string; e2: string }> = {}
  for (const [id, l] of feeders) libelles[id] = l

  return (
    <LiveManager
      tournoiId={tournoi.id}
      nom={tournoi.nom}
      nbTerrains={tournoi.nb_terrains}
      statut={tournoi.statut as StatutTournoi}
      matchsInitial={matchs}
      equipeInfos={equipeInfos}
      libelles={libelles}
    />
  )
}
