'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import ChronoLive from '@/components/ui/ChronoLive'
import LiveDot from '@/components/ui/LiveDot'
import GlassCard from '@/components/ui/GlassCard'
import LiquidButton from '@/components/ui/LiquidButton'
import { formatScoreSets } from '@/lib/score'
import type { FormatTournoi, Match, StatutTournoi } from '@/lib/supabase/database.types'
import { rafraichirEta } from './actions'
import styles from './tableau.module.css'

interface Props {
  tournoiId: string
  nom: string
  nbTerrains: number
  format: FormatTournoi
  statut: StatutTournoi
  matchsInitial: Match[]
  equipeNoms: Record<string, string>
  libelles: Record<string, { e1: string; e2: string }>
}

function formatHeure(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function TableauLive({
  tournoiId,
  nom,
  nbTerrains,
  format,
  statut,
  matchsInitial,
  equipeNoms,
  libelles,
}: Props) {
  const [matchs, setMatchs] = useState<Match[]>(matchsInitial)
  const [statutCourant, setStatutCourant] = useState<StatutTournoi>(statut)
  const [erreur, setErreur] = useState<string | null>(null)

  const demarre = statutCourant !== 'setup'

  useEffect(() => {
    const supabase = createClient()
    const rechargerMatchs = async () => {
      const { data } = await supabase.from('matchs').select('*').eq('tournoi_id', tournoiId)
      if (data) setMatchs(data as Match[])
    }
    const rechargerStatut = async () => {
      const { data } = await supabase.from('tournois').select('statut').eq('id', tournoiId).single()
      if (data) setStatutCourant(data.statut as StatutTournoi)
    }
    const channel = supabase
      .channel(`tableau-${tournoiId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchs', filter: `tournoi_id=eq.${tournoiId}` }, rechargerMatchs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournois', filter: `id=eq.${tournoiId}` }, rechargerStatut)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournoiId])

  // Lancement par un joueur : la RPC demarrer_match vérifie le code d'équipe.
  // En élimination on recalcule ensuite l'ETA (les convocations estimées bougent).
  const lancer = async (matchId: string) => {
    setErreur(null)
    const code = window.prompt('Code d’accès de ton équipe pour lancer le match :')
    if (!code) return
    const supabase = createClient()
    const { error } = await supabase.rpc('demarrer_match', { p_match_id: matchId, p_code_acces: code.trim() })
    if (error) {
      setErreur('Code invalide pour ce match, ou match déjà lancé.')
      return
    }
    if (format === 'elimination') await rafraichirEta(tournoiId)
    // Le reste arrive via Realtime (chrono qui démarre partout).
  }

  const header = (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className="wordmark" style={{ fontSize: 18, letterSpacing: '0.02em' }}>
          vamos
        </span>
        <span className={styles.brandTournoi}>{nom}</span>
      </div>
      {/* Emplacement sponsor — réservé, volontairement vide et sans style. */}
      <div className={styles.sponsorSlot} data-slot="sponsor" aria-label="Emplacement sponsor" />
      <span className={styles.liveTag}>
        {demarre ? (
          <>
            <LiveDot /> En direct
          </>
        ) : (
          'Pas encore démarré'
        )}
      </span>
    </header>
  )

  // Élimination : le board (design_handoff_vamos/tournoi-board). /tableau est un
  // écran public en LECTURE SEULE (cf. CLAUDE.md) — pas de bouton Lancer ici, le
  // démarrage se fait côté manager (/live et page check-in).
  if (format === 'elimination') {
    return <VueCreneaux matchs={matchs} equipeNoms={equipeNoms} libelles={libelles} nbTerrains={nbTerrains} erreur={erreur} />
  }

  return (
    <main className={styles.page}>
      {header}
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {!demarre && (
        <div className={styles.banner}>
          Le tournoi n&apos;a pas encore démarré. Les matchs pourront être lancés une fois que
          l&apos;organisateur aura démarré le tournoi.
        </div>
      )}
      <VueTerrains
        matchs={matchs}
        nbTerrains={nbTerrains}
        format={format}
        equipeNoms={equipeNoms}
        demarre={demarre}
        onLancer={lancer}
      />
    </main>
  )
}

// ── Horloge live du board (met à jour toutes les 20 s) ───────────────────────
function heureHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function BoardClock() {
  const [t, setT] = useState(heureHHMM())
  useEffect(() => {
    const id = setInterval(() => setT(heureHHMM()), 20000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className={styles.boardClock}>
      <span className={styles.boardClockTime}>{t}</span>
    </div>
  )
}

// ── Pill liquid-glass (statut de match / drapeaux) ───────────────────────────
function LiquidPill({ tone, children }: { tone: 'lpillStatus' | 'lpillStatusAccent' | 'lpillLive' | 'lpillNext'; children: ReactNode }) {
  return (
    <span className={`${styles.lpill} ${styles[tone]}`}>
      <span className={styles.lpillBg} />
      <span className={styles.lpillShadow} />
      <span className={styles.lpillContent}>{children}</span>
    </span>
  )
}

// Libellé de tour (« Quart de finale », « Consolante »…) déduit du nombre de
// matchs du tour (total/2^tour), sans avoir besoin de nb_equipes.
function roundLabel(m: Match, matchs: Match[]): string {
  if (m.tableau === 'consolante') return 'Consolante'
  const nb = matchs.filter((x) => x.tableau === 'winners' && x.tour === m.tour).length
  if (nb === 1) return 'Finale'
  if (nb === 2) return 'Demi-finale'
  if (nb === 4) return 'Quart de finale'
  if (nb === 8) return 'Huitième'
  if (nb === 16) return 'Seizième'
  return `Tour ${m.tour}`
}

// ── Board par CRÉNEAU (élimination) — une ligne par terrain ──────────────────
function VueCreneaux({
  matchs,
  equipeNoms,
  libelles,
  nbTerrains,
  erreur,
}: {
  matchs: Match[]
  equipeNoms: Record<string, string>
  libelles: Record<string, { e1: string; e2: string }>
  nbTerrains: number
  erreur: string | null
}) {
  const nomOuLabel = (m: Match, cote: 1 | 2): string => {
    const id = cote === 1 ? m.equipe1_id : m.equipe2_id
    if (id) return equipeNoms[id] ?? '—'
    return (cote === 1 ? libelles[m.id]?.e1 : libelles[m.id]?.e2) ?? 'À déterminer'
  }
  const inconnu = (m: Match, cote: 1 | 2) => (cote === 1 ? m.equipe1_id : m.equipe2_id) == null

  const joues = matchs.filter((m) => !m.est_bye && m.creneau != null)
  const creneaux = [...new Set(joues.map((m) => m.creneau as number))].sort((a, b) => a - b)
  const terrains = Array.from({ length: Math.max(1, nbTerrains) }, (_, i) => i + 1)

  const statutCreneau = (cr: number): 'termine' | 'en_cours' | 'a_venir' => {
    const ms = joues.filter((m) => m.creneau === cr)
    if (ms.some((m) => m.statut === 'en_cours')) return 'en_cours'
    if (ms.every((m) => m.statut === 'termine')) return 'termine'
    return 'a_venir'
  }
  const aSuivre = creneaux.find((cr) => statutCreneau(cr) === 'a_venir')
  const heureCreneau = (cr: number): string => {
    const t = joues
      .filter((m) => m.creneau === cr)
      .map((m) => m.heure_convocation_estimee ?? m.heure_convocation)
      .filter((x): x is string => !!x)
      .sort()[0]
    return formatHeure(t ?? null)
  }

  const header = (
    <header className={styles.boardHeader}>
      <h1 className={styles.boardTitle}>
        <span>vamos</span>
        <span className={styles.boardTitleAccent}>tournoi</span>
      </h1>
      {/* Emplacement sponsor — réservé, volontairement vide, à ne pas supprimer. */}
      <div className={styles.sponsorSlot} data-slot="sponsor" aria-label="Emplacement sponsor" />
      <BoardClock />
    </header>
  )

  return (
    <main className={styles.board}>
      {header}
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      <div className={styles.boardGrid}>
        {creneaux.map((cr) => {
          const etat = statutCreneau(cr)
          return (
            <section key={cr} className={`${styles.slot} ${etat === 'en_cours' ? styles.slotLive : ''}`.trim()}>
              <header className={styles.slotHead}>
                <div className={styles.slotTime}>
                  <span className={styles.slotTimeH}>{heureCreneau(cr)}</span>
                  <span className={styles.slotTimeMeta}>
                    {nbTerrains} terrain{nbTerrains > 1 ? 's' : ''}
                  </span>
                </div>
                {etat === 'en_cours' ? (
                  <LiquidPill tone="lpillLive">
                    <LiveDot /> En direct
                  </LiquidPill>
                ) : cr === aSuivre ? (
                  <LiquidPill tone="lpillNext">À suivre</LiquidPill>
                ) : null}
              </header>

              <div className={styles.slotBody}>
                {terrains.map((t) => {
                  const m = joues.find((x) => x.terrain === t && x.creneau === cr)
                  if (!m) {
                    return (
                      <div key={t} className={`${styles.match} ${styles.matchVide}`}>
                        <div className={styles.matchCourt}>
                          <span className={styles.courtLabel}>Terrain {t}</span>
                        </div>
                        <span className={styles.vide}>libre</span>
                        <span />
                      </div>
                    )
                  }
                  const live = m.statut === 'en_cours'
                  const score = formatScoreSets(m.score_equipe1, m.score_equipe2)
                  return (
                    <div key={t} className={`${styles.match} ${live ? styles.matchLive : ''}`.trim()}>
                      <div className={styles.matchCourt}>
                        <span className={styles.courtLabel}>Terrain {t}</span>
                        <LiquidPill tone={live ? 'lpillStatusAccent' : 'lpillStatus'}>
                          {live ? 'En cours' : m.statut === 'termine' ? 'Terminé' : roundLabel(m, matchs)}
                        </LiquidPill>
                      </div>
                      <div className={styles.teams}>
                        <span className={inconnu(m, 1) ? styles.inconnu : undefined}>{nomOuLabel(m, 1)}</span>
                        <span className={styles.teamsVs}>vs</span>
                        <span className={inconnu(m, 2) ? styles.inconnu : undefined}>{nomOuLabel(m, 2)}</span>
                      </div>
                      <div className={styles.matchEnd}>
                        {live && m.heure_debut ? (
                          <span className={styles.chronoWrapMini}>
                            <ChronoLive startTime={m.heure_debut} />
                          </span>
                        ) : m.statut === 'termine' && score ? (
                          <span className={styles.score}>{score}</span>
                        ) : null}
                      </div>
                      {live && <LiveDot />}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}

// ── Vue par TERRAIN (team americano & autres formats — inchangée) ────────────

function VueTerrains({
  matchs,
  nbTerrains,
  format,
  equipeNoms,
  demarre,
  onLancer,
}: {
  matchs: Match[]
  nbTerrains: number
  format: FormatTournoi
  equipeNoms: Record<string, string>
  demarre: boolean
  onLancer: (id: string) => void
}) {
  const nomEquipe = (id: string | null) => (id ? equipeNoms[id] ?? '—' : 'À déterminer')

  const matchDuTerrain = (terrain: number): Match | null => {
    const surTerrain = matchs.filter((m) => m.terrain === terrain && m.statut !== 'termine')
    const enCours = surTerrain.find((m) => m.statut === 'en_cours')
    if (enCours) return enCours
    const attente = surTerrain
      .filter((m) => m.statut === 'en_attente' || m.statut === 'equipes_presentes')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    return attente[0] ?? null
  }

  const scoreDe = (m: Match, cote: 1 | 2): string | null => {
    if (format === 'team_americano') {
      const v = cote === 1 ? m.score_equipe1_points : m.score_equipe2_points
      return v != null ? String(v) : null
    }
    return cote === 1 ? m.score_equipe1 : m.score_equipe2
  }

  const terrains = Array.from({ length: Math.max(1, nbTerrains) }, (_, i) => i + 1)

  return (
    <div className={styles.grid}>
      {terrains.map((t) => {
        const m = matchDuTerrain(t)
        const live = m?.statut === 'en_cours'
        return (
          <GlassCard key={t} className={`${styles.terrain} ${live ? styles.terrainLive : ''}`.trim()}>
            <div className={styles.terrainHead}>
              <span className={styles.terrainNom}>Terrain {t}</span>
              {live && m?.heure_debut && (
                <span className={styles.chronoWrap}>
                  <LiveDot /> <ChronoLive startTime={m.heure_debut} />
                </span>
              )}
            </div>
            {m ? (
              <>
                <div className={styles.equipes}>
                  <div className={styles.equipe}>
                    <span className={styles.equipeNom}>{nomEquipe(m.equipe1_id)}</span>
                    {scoreDe(m, 1) != null && <span className={styles.score}>{scoreDe(m, 1)}</span>}
                  </div>
                  <div className={styles.vs}>vs</div>
                  <div className={styles.equipe}>
                    <span className={styles.equipeNom}>{nomEquipe(m.equipe2_id)}</span>
                    {scoreDe(m, 2) != null && <span className={styles.score}>{scoreDe(m, 2)}</span>}
                  </div>
                </div>
                <div className={styles.foot}>
                  {live ? (
                    <span className={`${styles.badge} ${styles.badgeLive}`}>
                      <LiveDot /> En cours
                    </span>
                  ) : demarre ? (
                    <LiquidButton variant="primary" type="button" onClick={() => onLancer(m.id)}>
                      Lancer le match
                    </LiquidButton>
                  ) : (
                    <span className={styles.badge}>En attente du lancement</span>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.vide}>Aucun match sur ce terrain</div>
            )}
          </GlassCard>
        )
      })}
    </div>
  )
}
