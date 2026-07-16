'use client'

import { useEffect, useState } from 'react'
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

// Copie PURE de filtrerDemarrables (inlinée pour ne pas tirer next/headers dans
// le bundle client). Un match démarre si son terrain est libre + 2 équipes connues.
function demarrablesSur(matchs: Match[]): Set<string> {
  const occupes = new Set<number>()
  for (const m of matchs) if (m.statut === 'en_cours' && m.terrain != null) occupes.add(m.terrain)
  const ids = new Set<string>()
  for (const m of matchs) {
    if (
      m.statut === 'en_attente' &&
      m.est_bye === false &&
      m.equipe1_id != null &&
      m.equipe2_id != null &&
      m.terrain != null &&
      !occupes.has(m.terrain)
    )
      ids.add(m.id)
  }
  return ids
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

      {format === 'elimination' ? (
        <VueCreneaux
          matchs={matchs}
          equipeNoms={equipeNoms}
          libelles={libelles}
          demarre={demarre}
          onLancer={lancer}
        />
      ) : (
        <VueTerrains
          matchs={matchs}
          nbTerrains={nbTerrains}
          format={format}
          equipeNoms={equipeNoms}
          demarre={demarre}
          onLancer={lancer}
        />
      )}
    </main>
  )
}

// ── Vue par CRÉNEAU (élimination) ────────────────────────────────────────────

function VueCreneaux({
  matchs,
  equipeNoms,
  libelles,
  demarre,
  onLancer,
}: {
  matchs: Match[]
  equipeNoms: Record<string, string>
  libelles: Record<string, { e1: string; e2: string }>
  demarre: boolean
  onLancer: (id: string) => void
}) {
  const demarrables = demarrablesSur(matchs)
  const nomOuLabel = (m: Match, cote: 1 | 2): string => {
    const id = cote === 1 ? m.equipe1_id : m.equipe2_id
    if (id) return equipeNoms[id] ?? '—'
    return (cote === 1 ? libelles[m.id]?.e1 : libelles[m.id]?.e2) ?? 'À déterminer'
  }
  const inconnu = (m: Match, cote: 1 | 2) => (cote === 1 ? m.equipe1_id : m.equipe2_id) == null

  // Matchs joués (hors byes) groupés par créneau.
  const joues = matchs.filter((m) => !m.est_bye && m.creneau != null)
  const creneaux = [...new Set(joues.map((m) => m.creneau as number))].sort((a, b) => a - b)

  const statutCreneau = (cr: number): 'termine' | 'en_cours' | 'a_venir' => {
    const ms = joues.filter((m) => m.creneau === cr)
    if (ms.some((m) => m.statut === 'en_cours')) return 'en_cours'
    if (ms.every((m) => m.statut === 'termine')) return 'termine'
    return 'a_venir'
  }
  // « À suivre » = premier créneau à venir (le plus petit non terminé et sans en_cours).
  const aSuivre = creneaux.find((cr) => statutCreneau(cr) === 'a_venir')

  if (creneaux.length === 0) {
    return <p className={styles.vide}>Aucun match généré.</p>
  }

  return (
    <div className={styles.creneaux}>
      {creneaux.map((cr) => {
        const etat = statutCreneau(cr)
        const ms = joues
          .filter((m) => m.creneau === cr)
          .sort((a, b) => (a.terrain ?? 0) - (b.terrain ?? 0))
        return (
          <GlassCard key={cr} className={`${styles.creneauPanel} ${etat === 'en_cours' ? styles.creneauLive : ''}`.trim()}>
            <div className={styles.creneauHead}>
              <span className={styles.creneauNom}>Créneau {cr}</span>
              {etat === 'en_cours' ? (
                <span className={`${styles.pill} ${styles.pillLive}`}>
                  <LiveDot /> En direct
                </span>
              ) : cr === aSuivre ? (
                <span className={styles.pill}>À suivre</span>
              ) : etat === 'termine' ? (
                <span className={styles.pill}>Terminé</span>
              ) : null}
            </div>

            <div className={styles.matchList}>
              {ms.map((m) => {
                const live = m.statut === 'en_cours'
                const score = formatScoreSets(m.score_equipe1, m.score_equipe2)
                return (
                  <div key={m.id} className={`${styles.matchRow} ${live ? styles.matchRowLive : ''}`.trim()}>
                    <span className={styles.terrainBadge}>T{m.terrain}</span>
                    <div className={styles.matchTeams}>
                      <span className={inconnu(m, 1) ? styles.inconnu : undefined}>{nomOuLabel(m, 1)}</span>
                      <span className={styles.scoreMid}>{score || 'vs'}</span>
                      <span className={inconnu(m, 2) ? styles.inconnu : undefined}>{nomOuLabel(m, 2)}</span>
                    </div>
                    <div className={styles.matchEnd}>
                      {live && m.heure_debut ? (
                        <span className={styles.chronoWrap}>
                          <LiveDot /> <ChronoLive startTime={m.heure_debut} />
                        </span>
                      ) : m.statut === 'termine' ? (
                        <span className={styles.badge}>Terminé</span>
                      ) : demarre && demarrables.has(m.id) ? (
                        <LiquidButton variant="primary" type="button" onClick={() => onLancer(m.id)}>
                          Lancer
                        </LiquidButton>
                      ) : (
                        <span className={styles.eta}>{formatHeure(m.heure_convocation_estimee)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </GlassCard>
        )
      })}
    </div>
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
