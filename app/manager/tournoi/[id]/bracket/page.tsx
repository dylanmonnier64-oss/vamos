import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GlassCard from '@/components/ui/GlassCard'
import LiveDot from '@/components/ui/LiveDot'
import { nextPowerOfTwo } from '@/lib/bracket'
import type { Equipe, Match, StatutTournoi, Tournoi } from '@/lib/supabase/database.types'
import LancerButton from './LancerButton'
import CodesAcces from '@/components/ui/CodesAcces'
import styles from './bracket.module.css'

export const metadata: Metadata = {
  title: 'VAMOS · Tableau du tournoi',
}

// ─── Helpers d'affichage ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Nom du tour winners d'après le nombre de matchs qu'il contient (total/2^tour).
function labelTourWinners(tour: number, total: number): string {
  const nbMatchs = total / 2 ** tour
  if (nbMatchs === 1) return 'Finale'
  if (nbMatchs === 2) return 'Demi-finales'
  if (nbMatchs === 4) return 'Quarts de finale'
  if (nbMatchs === 8) return 'Huitièmes de finale'
  if (nbMatchs === 16) return 'Seizièmes de finale'
  return `Tour ${tour}`
}

// ─── Sous-composants (server components purs) ───────────────────────────────

function TeamRow({
  equipe,
  gagnant,
  score,
  estBye,
}: {
  equipe: Equipe | null
  gagnant: boolean
  score: string | null
  estBye: boolean
}) {
  if (!equipe) {
    return (
      <div className={`${styles.matchTeam} ${styles.matchTeamVide}`}>
        <span className={styles.matchTeamNom}>{estBye ? 'Exempt (bye)' : 'À déterminer'}</span>
      </div>
    )
  }
  return (
    <div className={`${styles.matchTeam} ${gagnant ? styles.matchTeamWin : ''}`.trim()}>
      <span className={styles.matchTeamNom}>
        {equipe.nom}
        {equipe.tete_serie != null && <span className={styles.seedTag}>TS{equipe.tete_serie}</span>}
      </span>
      {score != null && <span className={styles.matchScore}>{score}</span>}
    </div>
  )
}

function BadgeStatutMatch({ match }: { match: Match }) {
  if (match.est_bye) {
    return <span className={`${styles.badge} ${styles.badgeBye}`}>Bye</span>
  }
  switch (match.statut) {
    case 'en_cours':
      return (
        <span className={`${styles.badge} ${styles.badgeEnCours}`}>
          <LiveDot /> En cours
        </span>
      )
    case 'termine':
      return <span className={`${styles.badge} ${styles.badgeTermine}`}>Terminé</span>
    case 'equipes_presentes':
      return <span className={`${styles.badge} ${styles.badgePresent}`}>Équipes présentes</span>
    default:
      return <span className={`${styles.badge} ${styles.badgeAttente}`}>En attente</span>
  }
}

function MatchCard({ match, equipeMap }: { match: Match; equipeMap: Map<string, Equipe> }) {
  const e1 = match.equipe1_id ? equipeMap.get(match.equipe1_id) ?? null : null
  const e2 = match.equipe2_id ? equipeMap.get(match.equipe2_id) ?? null : null
  return (
    <GlassCard style={{ padding: '14px 16px', borderRadius: 16 }}>
      <TeamRow
        equipe={e1}
        gagnant={match.gagnant_id != null && match.gagnant_id === match.equipe1_id}
        score={match.score_equipe1}
        estBye={match.est_bye}
      />
      <div className={styles.matchSep} />
      <TeamRow
        equipe={e2}
        gagnant={match.gagnant_id != null && match.gagnant_id === match.equipe2_id}
        score={match.score_equipe2}
        estBye={match.est_bye}
      />
      <div className={styles.matchFoot}>
        <BadgeStatutMatch match={match} />
        {match.terrain != null && <span className={styles.terrain}>Terrain {match.terrain}</span>}
      </div>
    </GlassCard>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function BracketPage({ params }: { params: { id: string } }) {
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
  const equipeMap = new Map(equipes.map((e) => [e.id, e]))
  // Cette page est le tableau d'un tournoi élimination : nb_equipes y est
  // toujours renseigné (nullable seulement pour americano/mexicano, cf. 0003).
  const nbEquipes = tournoi.nb_equipes ?? 0
  const total = nextPowerOfTwo(nbEquipes)
  const statut = tournoi.statut as StatutTournoi

  // Winners : colonnes par `tour` (1, 2, 3… jusqu'à la finale).
  const winners = matchs.filter((m) => m.tableau === 'winners')
  const toursWinners = [...new Set(winners.map((m) => m.tour))].sort((a, b) => a - b)

  // Consolante : groupée par vague (waveR = Math.floor(tour/100)), puis
  // sous-colonnes par sous-tour (subTour = tour % 100).
  const consolante = matchs.filter((m) => m.tableau === 'consolante')
  const parVague = new Map<number, Match[]>()
  for (const m of consolante) {
    const waveR = Math.floor(m.tour / 100)
    const arr = parVague.get(waveR)
    if (arr) arr.push(m)
    else parVague.set(waveR, [m])
  }
  const vagues = [...parVague.keys()].sort((a, b) => a - b)

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
            <span>{tournoi.categorie_fft}</span>
            <span>·</span>
            <span>{formatDate(tournoi.date)}</span>
            <span>·</span>
            <span>
              {nbEquipes} équipe{nbEquipes > 1 ? 's' : ''}
            </span>
            <span>·</span>
            <span
              className={`${styles.statutTournoi} ${statut === 'en_cours' ? styles.statutEnCours : ''}`.trim()}
            >
              {statut === 'en_cours' && <LiveDot />}
              {statut === 'setup' ? 'Brouillon' : statut === 'en_cours' ? 'En cours' : 'Terminé'}
            </span>
          </div>
        </div>

        {statut === 'setup' && (
          <div className={styles.launchZone}>
            <LancerButton tournoiId={tournoi.id} />
          </div>
        )}
        {statut === 'en_cours' && (
          <div className={styles.launchZone}>
            <Link href={`/manager/tournoi/${tournoi.id}/checkin`} className={styles.navLien}>
              Check-in
            </Link>
            <Link href={`/manager/tournoi/${tournoi.id}/live`} className={styles.navLien}>
              Suivi live →
            </Link>
          </div>
        )}
      </header>

      {/* Codes d'accès — visibles seulement une fois le tournoi lancé. */}
      {statut !== 'setup' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Liens d&apos;accès des équipes</h2>
          <p className={styles.sectionHint}>
            Aucun envoi automatique pour l&apos;instant : communique ces liens (ou le code) à chaque
            équipe manuellement. Chaque équipe accède à son espace via son code.
          </p>
          <CodesAcces equipes={codesEquipes} />
        </section>
      )}

      {/* Tableau principal (winners). */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tableau principal</h2>
        {toursWinners.length === 0 ? (
          <p className={styles.empty}>Aucun match généré.</p>
        ) : (
          <div className={styles.rounds}>
            {toursWinners.map((tour) => {
              const matchsDuTour = winners
                .filter((m) => m.tour === tour)
                .sort((a, b) => a.match_num - b.match_num)
              return (
                <div key={tour} className={styles.round}>
                  <div className={styles.roundTitle}>{labelTourWinners(tour, total)}</div>
                  {matchsDuTour.map((m) => (
                    <MatchCard key={m.id} match={m} equipeMap={equipeMap} />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Consolante — une colonne (bloc) par vague. */}
      {vagues.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Consolante</h2>
          <div className={styles.rounds}>
            {vagues.map((waveR) => {
              const matchsVague = parVague.get(waveR) ?? []
              const bande = matchsVague[0]?.places_en_jeu ?? `Vague ${waveR}`
              const subTours = [...new Set(matchsVague.map((m) => m.tour % 100))].sort(
                (a, b) => a - b
              )
              const dernierSub = Math.max(...subTours)
              return (
                <div key={waveR} className={styles.vague}>
                  <h3 className={styles.vagueTitle}>{bande}</h3>
                  <div className={styles.rounds}>
                    {subTours.map((sub) => {
                      const matchsSub = matchsVague
                        .filter((m) => m.tour % 100 === sub)
                        .sort((a, b) => a.match_num - b.match_num)
                      return (
                        <div key={sub} className={styles.round}>
                          <div className={styles.roundTitle}>
                            {sub === dernierSub && subTours.length > 1
                              ? 'Finale'
                              : subTours.length === 1
                                ? 'Match'
                                : `Sous-tour ${sub}`}
                          </div>
                          {matchsSub.map((m) => (
                            <MatchCard key={m.id} match={m} equipeMap={equipeMap} />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}
