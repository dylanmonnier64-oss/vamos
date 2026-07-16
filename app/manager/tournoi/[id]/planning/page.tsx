import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LiveDot from '@/components/ui/LiveDot'
import CodesAcces from '@/components/ui/CodesAcces'
import type { Equipe, Match, StatutTournoi, Tournoi } from '@/lib/supabase/database.types'
import LancerButton from '../bracket/LancerButton'
import styles from './planning.module.css'

export const metadata: Metadata = {
  title: 'VAMOS · Planning team americano',
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Page de revue AVANT lancement d'un tournoi team americano : planning
// round-robin + codes d'accès + bouton "Lancer le tournoi". Même structure que
// la page bracket (revue → lancement), mais vue round-robin (pas de bracket).
export default async function PlanningPage({ params }: { params: { id: string } }) {
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

  // Cette page n'a de sens que pour le team americano — c'est LE seul format qui
  // encode `tour` en round de round-robin. Pour l'élimination, on renvoie vers
  // la page bracket (on ne lit jamais `tour` sans discriminer le format).
  if (tournoi.format !== 'team_americano') {
    redirect(`/manager/tournoi/${tournoi.id}/bracket`)
  }

  const [{ data: equipesData }, { data: matchsData }] = await Promise.all([
    supabase.from('equipes').select('id, nom, code_acces').eq('tournoi_id', params.id),
    supabase.from('matchs').select('*').eq('tournoi_id', params.id),
  ])

  const equipes = (equipesData ?? []) as Pick<Equipe, 'id' | 'nom' | 'code_acces'>[]
  const matchs = (matchsData ?? []) as Match[]
  const equipeNoms = new Map(equipes.map((e) => [e.id, e.nom]))
  const statut = tournoi.statut as StatutTournoi

  const nomEquipe = (id: string | null) => (id ? (equipeNoms.get(id) ?? '—') : '—')

  // Planning : groupé par round (matchs.tour = round de round-robin, format
  // team americano confirmé ci-dessus). Byes déduits (paire absente du round).
  const rounds = [...new Set(matchs.map((m) => m.tour))].sort((a, b) => a - b)

  const codesEquipes = [...equipes]
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map((e) => ({ id: e.id, nom: e.nom, code_acces: e.code_acces }))

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.titleBlock}>
          <Link href="/manager/dashboard" className={styles.backLink}>
            ← Tableau de bord
          </Link>
          <h1 className={styles.title}>{tournoi.nom}</h1>
          <div className={styles.subtitle}>
            <span>Team americano</span>
            <span>·</span>
            <span>{formatDate(tournoi.date)}</span>
            <span>·</span>
            <span>
              {tournoi.nb_equipes ?? equipes.length} paire
              {(tournoi.nb_equipes ?? equipes.length) > 1 ? 's' : ''}
            </span>
            {tournoi.points_par_match && (
              <>
                <span>·</span>
                <span>{tournoi.points_par_match} pts / match</span>
              </>
            )}
            <span>·</span>
            <span
              className={`${styles.statutTournoi} ${statut === 'en_cours' ? styles.statutEnCours : ''}`.trim()}
            >
              {statut === 'en_cours' && <LiveDot />}
              {statut === 'setup' ? 'Brouillon' : statut === 'en_cours' ? 'En cours' : 'Terminé'}
            </span>
          </div>
        </div>

        <div className={styles.launchZone}>
          {statut === 'setup' ? (
            <LancerButton tournoiId={tournoi.id} />
          ) : (
            <Link href={`/tableau/${tournoi.id}`} className={styles.liveLink}>
              Écran live →
            </Link>
          )}
        </div>
      </header>

      {/* Codes d'accès — visibles dès la revue pour que le manager les distribue. */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Liens d&apos;accès des équipes</h2>
        <p className={styles.sectionHint}>
          Distribue ces liens (ou le code) à chaque paire. Les matchs ne pourront démarrer
          qu&apos;une fois le tournoi lancé ci-dessus.
        </p>
        <CodesAcces equipes={codesEquipes} />
      </section>

      {/* Planning round-robin. */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Planning round-robin</h2>
        {rounds.length === 0 ? (
          <p className={styles.sectionHint}>Aucun match généré.</p>
        ) : (
          <div className={styles.rounds}>
            {rounds.map((round) => {
              const matchsDuRound = matchs
                .filter((m) => m.tour === round)
                .sort((a, b) => a.match_num - b.match_num)
              return (
                <div key={round} className={styles.round}>
                  <div className={styles.roundTitle}>Round {round}</div>
                  {matchsDuRound.map((m) => (
                    <div key={m.id} className={styles.match}>
                      <span className={styles.equipe}>{nomEquipe(m.equipe1_id)}</span>
                      <span className={styles.vs}>vs</span>
                      <span className={`${styles.equipe} ${styles.equipeDroite}`}>
                        {nomEquipe(m.equipe2_id)}
                      </span>
                      <span className={styles.terrain}>
                        {m.terrain != null ? `Terrain ${m.terrain}` : 'À suivre'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
