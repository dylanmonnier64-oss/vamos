import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { nextPowerOfTwo, nourriciersDe } from '@/lib/bracket'
import { libellesFeeders } from '@/lib/libelles'
import { fourchettePoints } from '@/lib/fft'
import type { EquipePublic, Match, Tournoi } from '@/lib/supabase/database.types'
import TPlayer from './TPlayer'
import styles from './t.module.css'

export const metadata: Metadata = {
  title: 'VAMOS · Mon espace',
}

interface FeederRef {
  tableau: 'winners' | 'consolante'
  tour: number
  match_num: number
}

// Ligne renvoyée par get_equipe_by_code (SECURITY DEFINER, 0001) — sans code_acces.
interface EquipeParCode {
  id: string
  tournoi_id: string
  nom: string
  joueur1: string
  joueur2: string
  tete_serie: number | null
  tableau: 'winners' | 'consolante' | null
  place_finale: number | null
  points_fft: number | null
}

export default async function TPage({ params }: { params: { code: string } }) {
  const code = params.code
  const supabase = await createClient()

  // Accès par code — la table equipes n'est JAMAIS exposée (RPC SECURITY DEFINER).
  const { data: eqRows } = await supabase.rpc('get_equipe_by_code', { p_code: code })
  const equipe = (eqRows as EquipeParCode[] | null)?.[0]

  if (!equipe) {
    return (
      <main className={styles.errorPage}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitre}>Code inconnu</h1>
          <p className={styles.errorTexte}>
            Ce code d&apos;accès ne correspond à aucune équipe. Vérifie le lien reçu de
            l&apos;organisateur.
          </p>
        </div>
      </main>
    )
  }

  const { data: tournoi } = await supabase
    .from('tournois')
    .select('*')
    .eq('id', equipe.tournoi_id)
    .single<Tournoi>()
  if (!tournoi) {
    return (
      <main className={styles.errorPage}>
        <div className={styles.errorCard}>
          <h1 className={styles.errorTitre}>Tournoi introuvable</h1>
          <p className={styles.errorTexte}>Le tournoi lié à ce code n&apos;existe plus.</p>
        </div>
      </main>
    )
  }

  const [{ data: matchsData }, { data: equipesData }] = await Promise.all([
    supabase.from('matchs').select('*').eq('tournoi_id', equipe.tournoi_id),
    supabase.from('equipes_public').select('*').eq('tournoi_id', equipe.tournoi_id),
  ])
  const matchs = (matchsData ?? []) as Match[]
  const equipes = (equipesData ?? []) as EquipePublic[]

  const total = nextPowerOfTwo(tournoi.nb_equipes ?? 0)
  // Précalcul SERVEUR (évite d'embarquer lib/bracket + le barème FFT dans le
  // bundle client mobile) : libellés, refs nourriciers et fourchettes de points.
  const libelles: Record<string, { e1: string; e2: string }> = {}
  const feederRefs: Record<string, [FeederRef | null, FeederRef | null]> = {}
  const fourchettes: Record<string, { min: number; max: number } | null> = {}
  if (tournoi.format === 'elimination') {
    for (const [id, l] of libellesFeeders(matchs, total)) libelles[id] = l
    for (const m of matchs) {
      const refs = nourriciersDe(m, total)
      feederRefs[m.id] = [refs[0] ?? null, refs[1] ?? null]
      fourchettes[m.id] = fourchettePoints(m.places_en_jeu, tournoi.categorie_fft, tournoi.nb_equipes ?? 0)
    }
  }

  const equipeInfos: Record<string, { nom: string; joueur1: string; joueur2: string; tete_serie: number | null }> = {}
  for (const e of equipes) {
    equipeInfos[e.id] = { nom: e.nom, joueur1: e.joueur1, joueur2: e.joueur2, tete_serie: e.tete_serie }
  }

  return (
    <TPlayer
      code={code}
      tournoiId={tournoi.id}
      tournoiNom={tournoi.nom}
      format={tournoi.format}
      statut={tournoi.statut}
      nbEquipes={tournoi.nb_equipes ?? 0}
      afficherPoints={tournoi.afficher_points_indicatifs}
      equipe={{
        id: equipe.id,
        nom: equipe.nom,
        joueur1: equipe.joueur1,
        joueur2: equipe.joueur2,
        tete_serie: equipe.tete_serie,
        tableau: equipe.tableau,
        place_finale: equipe.place_finale,
        points_fft: equipe.points_fft,
      }}
      matchsInitial={matchs}
      equipeInfos={equipeInfos}
      libelles={libelles}
      feederRefs={feederRefs}
      fourchettes={fourchettes}
    />
  )
}
