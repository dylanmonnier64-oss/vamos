import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GlassCard from '@/components/ui/GlassCard'
import LiveDot from '@/components/ui/LiveDot'
import type { StatutTournoi, Tournoi } from '@/lib/supabase/database.types'
import { t } from '@/lib/i18n'
import LogoutButton from './LogoutButton'
import NewTournoiButton from './NewTournoiButton'
import styles from './dashboard.module.css'

export const metadata: Metadata = {
  title: t('dashboard.metaTitre'),
}

// en_cours d'abord, puis setup (brouillon), puis termine.
const PRIORITE_STATUT: Record<StatutTournoi, number> = { en_cours: 0, setup: 1, termine: 2 }

function formatDate(iso: string): string {
  // `iso` est une date seule (yyyy-mm-dd) ; on ancre à midi UTC pour éviter un
  // décalage de jour selon le fuseau du serveur.
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function hrefPourTournoi(tournoi: Tournoi): string {
  // Team americano : en 'setup' → page de revue /planning (planning + codes +
  // bouton Lancer) ; une fois lancé → écran live /tableau.
  if (tournoi.format === 'team_americano') {
    return tournoi.statut === 'setup'
      ? `/manager/tournoi/${tournoi.id}/planning`
      : `/tableau/${tournoi.id}`
  }
  // Élimination : en_cours → live ; setup & termine → bracket.
  if (tournoi.statut === 'en_cours') return `/manager/tournoi/${tournoi.id}/live`
  return `/manager/tournoi/${tournoi.id}/bracket`
}

function BadgeStatut({ statut }: { statut: StatutTournoi }) {
  if (statut === 'en_cours') {
    return (
      <span className={`${styles.badge} ${styles.badgeEnCours}`}>
        <LiveDot /> {t('dashboard.statutEnCours')}
      </span>
    )
  }
  if (statut === 'setup') {
    return <span className={`${styles.badge} ${styles.badgeBrouillon}`}>{t('dashboard.statutBrouillon')}</span>
  }
  return <span className={`${styles.badge} ${styles.badgeTermine}`}>{t('dashboard.statutTermine')}</span>
}

export default async function DashboardPage() {
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

  const { data: organisation } = userRow
    ? await supabase.from('organisations').select('nom').eq('id', userRow.organisation_id).single()
    : { data: null }

  const { data: tournoisData } = userRow
    ? await supabase.from('tournois').select('*').eq('organisation_id', userRow.organisation_id)
    : { data: null }

  const tournois = ((tournoisData ?? []) as Tournoi[])
    .slice()
    .sort(
      (a, b) =>
        PRIORITE_STATUT[a.statut] - PRIORITE_STATUT[b.statut] ||
        // à statut égal, le plus récent en premier
        (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
    )

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className="wordmark" style={{ fontSize: 20, letterSpacing: '0.02em' }}>
            vamos
          </span>
          {organisation?.nom && <span className={styles.brandOrg}>{organisation.nom}</span>}
        </div>
        <LogoutButton />
      </header>

      {!userRow ? (
        <p className={styles.notice}>{t('dashboard.pasDeClub')}</p>
      ) : (
        <>
          <div className={styles.headerRow}>
            <h1 className={styles.headerTitle}>{t('dashboard.titre')}</h1>
            {tournois.length > 0 && <NewTournoiButton />}
          </div>

          {tournois.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>{t('dashboard.videTexte')}</p>
              <NewTournoiButton />
            </div>
          ) : (
            <div className={styles.grid}>
              {tournois.map((tournoi) => (
                <Link key={tournoi.id} href={hrefPourTournoi(tournoi)} className={styles.cardLink}>
                  <GlassCard className={styles.card}>
                    <div className={styles.cardTop}>
                      <h2 className={styles.cardNom}>{tournoi.nom}</h2>
                      <BadgeStatut statut={tournoi.statut} />
                    </div>
                    <div className={styles.cardMeta}>
                      <div className={styles.cardMetaRow}>
                        <span className={styles.cardMetaLabel}>{t('dashboard.labelDate')}</span>
                        <span className={styles.cardMetaValue}>{formatDate(tournoi.date)}</span>
                      </div>
                      <div className={styles.cardMetaRow}>
                        <span className={styles.cardMetaLabel}>{t('dashboard.labelCategorie')}</span>
                        <span className={styles.cardMetaValue}>{tournoi.categorie_fft}</span>
                      </div>
                      <div className={styles.cardMetaRow}>
                        <span className={styles.cardMetaLabel}>{t('dashboard.labelEquipes')}</span>
                        <span className={styles.cardMetaValue}>{tournoi.nb_equipes}</span>
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
