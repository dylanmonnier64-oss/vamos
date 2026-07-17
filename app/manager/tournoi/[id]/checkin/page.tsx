import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Equipe, Match, StatutTournoi, Tournoi } from '@/lib/supabase/database.types'
import CheckinClient from './CheckinClient'

export const metadata: Metadata = {
  title: 'VAMOS · Check-in des équipes',
}

export default async function CheckinPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/manager/login')

  const { data: tournoi } = await supabase
    .from('tournois')
    .select('*')
    .eq('id', params.id)
    .single<Tournoi>()
  if (!tournoi) notFound()

  const [{ data: equipesData }, { data: matchsData }] = await Promise.all([
    supabase.from('equipes').select('*').eq('tournoi_id', params.id),
    supabase.from('matchs').select('*').eq('tournoi_id', params.id),
  ])
  const equipes = ((equipesData ?? []) as Equipe[])
    .map((e) => ({ id: e.id, nom: e.nom, tete_serie: e.tete_serie }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const equipeNoms: Record<string, string> = {}
  for (const e of equipes) equipeNoms[e.id] = e.nom

  return (
    <CheckinClient
      tournoiId={tournoi.id}
      nom={tournoi.nom}
      statut={tournoi.statut as StatutTournoi}
      equipes={equipes}
      equipeNoms={equipeNoms}
      matchsInitial={(matchsData ?? []) as Match[]}
    />
  )
}
