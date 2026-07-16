'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ChronoLive from '@/components/ui/ChronoLive'
import LiveDot from '@/components/ui/LiveDot'
import GlassCard from '@/components/ui/GlassCard'
import LiquidButton from '@/components/ui/LiquidButton'
import { parseSaisieCombinee, formatScoreSets } from '@/lib/score'
import type { Match, StatutTournoi } from '@/lib/supabase/database.types'
import { validerScoreManager, demarrerMatchManager, cocherPresence } from './actions'
import styles from './live.module.css'

interface Props {
  tournoiId: string
  nom: string
  nbTerrains: number
  statut: StatutTournoi
  matchsInitial: Match[]
  equipeInfos: Record<string, { nom: string; tete_serie: number | null }>
  libelles: Record<string, { e1: string; e2: string }>
}

// Copie PURE de filtrerDemarrables (lib/demarrage) — inlinée pour ne pas tirer
// le wrapper DB (next/headers) dans le bundle client. Doit rester synchrone.
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
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function LiveManager({
  tournoiId,
  nom,
  nbTerrains,
  statut,
  matchsInitial,
  equipeInfos,
  libelles,
}: Props) {
  const [matchs, setMatchs] = useState<Match[]>(matchsInitial)
  const [statutCourant, setStatutCourant] = useState<StatutTournoi>(statut)
  const [saisies, setSaisies] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

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
      .channel(`live-${tournoiId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchs', filter: `tournoi_id=eq.${tournoiId}` }, rechargerMatchs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournois', filter: `id=eq.${tournoiId}` }, rechargerStatut)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournoiId])

  const nomEquipe = (id: string | null): string => (id ? equipeInfos[id]?.nom ?? '—' : '')
  const nomOuLabel = (m: Match, cote: 1 | 2): string => {
    const id = cote === 1 ? m.equipe1_id : m.equipe2_id
    if (id) return equipeInfos[id]?.nom ?? '—'
    return (cote === 1 ? libelles[m.id]?.e1 : libelles[m.id]?.e2) ?? 'À déterminer'
  }
  const equipeConnue = (m: Match, cote: 1 | 2) => (cote === 1 ? m.equipe1_id : m.equipe2_id) != null

  const demarrables = demarrablesSur(matchs)

  const valider = async (matchId: string, s1: string, s2: string) => {
    setBusy(matchId)
    setErreur(null)
    const r = await validerScoreManager(tournoiId, matchId, s1, s2)
    setBusy(null)
    if (r?.error) setErreur(r.error)
    else setSaisies((prev) => ({ ...prev, [matchId]: '' }))
  }

  const validerSaisie = async (matchId: string) => {
    const parsed = parseSaisieCombinee(saisies[matchId] ?? '')
    if (!parsed) {
      setErreur('Format de score invalide. Exemple : 6-4 6-3')
      return
    }
    await valider(matchId, parsed.s1, parsed.s2)
  }

  const lancer = async (matchId: string) => {
    setBusy(matchId)
    setErreur(null)
    const r = await demarrerMatchManager(tournoiId, matchId)
    setBusy(null)
    if (r?.error) setErreur(r.error)
  }

  const presence = async (matchId: string, cote: 1 | 2, present: boolean) => {
    setErreur(null)
    const r = await cocherPresence(tournoiId, matchId, cote, present)
    if (r?.error) setErreur(r.error)
  }

  const terrains = Array.from({ length: Math.max(1, nbTerrains) }, (_, i) => i + 1)

  // Prochains matchs (colonne droite) : en attente, non-bye, triés par ETA.
  const heure = (m: Match) => m.heure_convocation_estimee ?? m.heure_convocation ?? ''
  const prochains = matchs
    .filter((m) => (m.statut === 'en_attente' || m.statut === 'equipes_presentes') && !m.est_bye)
    .sort((a, b) => heure(a).localeCompare(heure(b)) || (a.creneau ?? 0) - (b.creneau ?? 0))

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Link href={`/manager/tournoi/${tournoiId}/bracket`} className={styles.back}>
            ← Tableau
          </Link>
          <span className={styles.titre}>{nom}</span>
        </div>
        <span className={styles.liveTag}>
          {statutCourant === 'en_cours' ? (
            <>
              <LiveDot /> En direct
            </>
          ) : statutCourant === 'termine' ? (
            'Terminé'
          ) : (
            'Pas encore démarré'
          )}
        </span>
      </header>

      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {statutCourant === 'setup' && (
        <div className={styles.banner}>
          Le tournoi n&apos;est pas encore lancé. Démarre-le depuis le tableau pour activer les
          terrains.
        </div>
      )}

      <div className={styles.split}>
        {/* ── Colonne gauche : terrains ─────────────────────────────────── */}
        <section className={styles.colonne}>
          <h2 className={styles.colTitre}>Terrains</h2>
          {terrains.map((t) => {
            const enCours = matchs.find((m) => m.terrain === t && m.statut === 'en_cours' && !m.est_bye)
            const dem = matchs.find((m) => m.terrain === t && demarrables.has(m.id))
            const prochain = matchs
              .filter((m) => m.terrain === t && m.statut !== 'termine' && !m.est_bye)
              .sort((a, b) => (a.creneau ?? 0) - (b.creneau ?? 0))[0]

            return (
              <GlassCard key={t} className={`${styles.terrain} ${enCours ? styles.terrainLive : ''}`.trim()}>
                <div className={styles.terrainHead}>
                  <span className={styles.terrainNom}>Terrain {t}</span>
                  {enCours?.heure_debut && (
                    <span className={styles.chronoWrap}>
                      <LiveDot /> <ChronoLive startTime={enCours.heure_debut} />
                    </span>
                  )}
                </div>

                {enCours ? (
                  enCours.statut_score === 'conteste' ? (
                    <ContesteBloc
                      match={enCours}
                      nomEquipe={nomEquipe}
                      busy={busy === enCours.id}
                      onArbitrer={(s1, s2) => valider(enCours.id, s1, s2)}
                    />
                  ) : (
                    <div className={styles.match}>
                      <EquipeLigne
                        nom={nomOuLabel(enCours, 1)}
                        seed={enCours.equipe1_id ? equipeInfos[enCours.equipe1_id]?.tete_serie ?? null : null}
                        presente={enCours.equipe1_presente}
                        onPresence={(v) => presence(enCours.id, 1, v)}
                      />
                      <EquipeLigne
                        nom={nomOuLabel(enCours, 2)}
                        seed={enCours.equipe2_id ? equipeInfos[enCours.equipe2_id]?.tete_serie ?? null : null}
                        presente={enCours.equipe2_presente}
                        onPresence={(v) => presence(enCours.id, 2, v)}
                      />
                      <div className={styles.scoreForm}>
                        <input
                          className="form-input"
                          placeholder="6-4 6-3"
                          value={saisies[enCours.id] ?? ''}
                          onChange={(e) => setSaisies((p) => ({ ...p, [enCours.id]: e.target.value }))}
                          disabled={busy === enCours.id}
                        />
                        <LiquidButton
                          variant="primary"
                          type="button"
                          onClick={() => validerSaisie(enCours.id)}
                          disabled={busy === enCours.id}
                        >
                          Valider
                        </LiquidButton>
                      </div>
                    </div>
                  )
                ) : dem ? (
                  <div className={styles.match}>
                    <div className={styles.equipeSimple}>{nomOuLabel(dem, 1)}</div>
                    <div className={styles.vs}>vs</div>
                    <div className={styles.equipeSimple}>{nomOuLabel(dem, 2)}</div>
                    <div className={styles.foot}>
                      <LiquidButton
                        variant="primary"
                        type="button"
                        onClick={() => lancer(dem.id)}
                        disabled={busy === dem.id}
                      >
                        Lancer le match
                      </LiquidButton>
                    </div>
                  </div>
                ) : prochain ? (
                  <div className={styles.attente}>
                    <div className={styles.equipeSimple}>{nomOuLabel(prochain, 1)}</div>
                    <div className={styles.vs}>vs</div>
                    <div className={styles.equipeSimple}>{nomOuLabel(prochain, 2)}</div>
                    <p className={styles.raison}>
                      {!equipeConnue(prochain, 1)
                        ? `En attente de ${libelles[prochain.id]?.e1 ?? '…'}`
                        : !equipeConnue(prochain, 2)
                          ? `En attente de ${libelles[prochain.id]?.e2 ?? '…'}`
                          : 'Prêt — en attente'}
                    </p>
                  </div>
                ) : (
                  <div className={styles.vide}>Aucun match restant sur ce terrain</div>
                )}
              </GlassCard>
            )
          })}
        </section>

        {/* ── Colonne droite : prochains matchs ─────────────────────────── */}
        <section className={styles.colonne}>
          <h2 className={styles.colTitre}>Prochains matchs</h2>
          {prochains.length === 0 ? (
            <p className={styles.vide}>Aucun match à venir.</p>
          ) : (
            <div className={styles.prochainList}>
              {prochains.map((m) => {
                const inconnu1 = !equipeConnue(m, 1)
                const inconnu2 = !equipeConnue(m, 2)
                return (
                  <div key={m.id} className={styles.prochainItem}>
                    <div className={styles.prochainMeta}>
                      <span className={styles.prochainTerrain}>T{m.terrain}</span>
                      <span className={styles.prochainEta}>{formatHeure(m.heure_convocation_estimee)}</span>
                    </div>
                    <div className={styles.prochainEquipes}>
                      <span className={inconnu1 ? styles.inconnu : undefined}>{nomOuLabel(m, 1)}</span>
                      <span className={styles.vsMini}>vs</span>
                      <span className={inconnu2 ? styles.inconnu : undefined}>{nomOuLabel(m, 2)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

// ── Sous-composants ──────────────────────────────────────────────────────────

function EquipeLigne({
  nom,
  seed,
  presente,
  onPresence,
}: {
  nom: string
  seed: number | null
  presente: boolean
  onPresence: (v: boolean) => void
}) {
  return (
    <div className={styles.equipeLigne}>
      <label className={styles.presence}>
        <input type="checkbox" checked={presente} onChange={(e) => onPresence(e.target.checked)} />
      </label>
      <span className={styles.equipeNom}>
        {nom}
        {seed != null && <span className={styles.seed}>TS{seed}</span>}
      </span>
    </div>
  )
}

function ContesteBloc({
  match,
  nomEquipe,
  busy,
  onArbitrer,
}: {
  match: Match
  nomEquipe: (id: string | null) => string
  busy: boolean
  onArbitrer: (s1: string, s2: string) => void
}) {
  const [saisie, setSaisie] = useState('')
  const entrees = Object.entries(match.propositions_score ?? {})
  return (
    <div className={styles.conteste}>
      <p className={styles.contesteTitre}>⚠ Score contesté — à trancher</p>
      <div className={styles.propositions}>
        {entrees.map(([equipeId, prop]) => (
          <div key={equipeId} className={styles.proposition}>
            <span className={styles.propPar}>{nomEquipe(equipeId)}</span>
            <span className={styles.propScore}>{formatScoreSets(prop.e1, prop.e2)}</span>
            <LiquidButton
              variant="secondary"
              type="button"
              disabled={busy}
              onClick={() => onArbitrer(prop.e1, prop.e2)}
            >
              Retenir
            </LiquidButton>
          </div>
        ))}
      </div>
      <div className={styles.scoreForm}>
        <input
          className="form-input"
          placeholder="Autre score : 6-4 6-3"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          disabled={busy}
        />
        <LiquidButton
          variant="primary"
          type="button"
          disabled={busy}
          onClick={() => {
            const parsed = parseSaisieCombinee(saisie)
            if (parsed) onArbitrer(parsed.s1, parsed.s2)
          }}
        >
          Valider
        </LiquidButton>
      </div>
    </div>
  )
}
