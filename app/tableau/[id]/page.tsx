import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { nextPowerOfTwo } from '@/lib/bracket'
import { libellesFeeders } from '@/lib/libelles'
import type { Match, Tournoi } from '@/lib/supabase/database.types'
import TableauLive from './TableauLive'

export const metadata: Metadata = {
  title: 'VAMOS · Tableau live',
}

// Écran public (TV du complexe / lien joueur) — aucune session requise.
// Lectures publiques : tournois, matchs, equipes_public (grants anon, 0001).
export default async function TableauPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: tournoi } = await supabase
    .from('tournois')
    .select('*')
    .eq('id', params.id)
    .single<Tournoi>()
  if (!tournoi) {
    notFound()
  }

  const [{ data: matchsData }, { data: equipesData }] = await Promise.all([
    supabase.from('matchs').select('*').eq('tournoi_id', params.id),
    supabase.from('equipes_public').select('id, nom').eq('tournoi_id', params.id),
  ])

  const equipeNoms: Record<string, string> = {}
  for (const e of (equipesData ?? []) as { id: string; nom: string }[]) {
    equipeNoms[e.id] = e.nom
  }

  const matchs = (matchsData ?? []) as Match[]

  // Libellés des nourriciers (élimination uniquement) : « Vainqueur T1 · créneau 2 »…
  // Le terrain étant immuable, ils restent vrais toute la durée du tournoi.
  const libelles: Record<string, { e1: string; e2: string }> = {}
  if (tournoi.format === 'elimination') {
    const total = nextPowerOfTwo(tournoi.nb_equipes ?? 0)
    for (const [id, l] of libellesFeeders(matchs, total)) libelles[id] = l
  }

  return (
    <TableauLive
      tournoiId={tournoi.id}
      nom={tournoi.nom}
      nbTerrains={tournoi.nb_terrains}
      format={tournoi.format}
      statut={tournoi.statut}
      matchsInitial={matchs}
      equipeNoms={equipeNoms}
      libelles={libelles}
    />
  )
}
