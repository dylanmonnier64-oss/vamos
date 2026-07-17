'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ChronoLive from '@/components/ui/ChronoLive'
import LiveDot from '@/components/ui/LiveDot'
import LiquidButton from '@/components/ui/LiquidButton'
import { parseSaisieCombinee, formatScoreSets } from '@/lib/score'
import type { FormatTournoi, Match, StatutTournoi } from '@/lib/supabase/database.types'
import { proposerScore } from './actions'
import styles from './t.module.css'

// Refs nourriciers précalculées côté serveur (évite lib/bracket dans le bundle).
interface FeederRef {
  tableau: 'winners' | 'consolante'
  tour: number
  match_num: number
}

interface EquipeInfo {
  nom: string
  joueur1: string
  joueur2: string
  tete_serie: number | null
}
interface Props {
  code: string
  tournoiId: string
  tournoiNom: string
  format: FormatTournoi
  statut: StatutTournoi
  nbEquipes: number
  afficherPoints: boolean
  equipe: {
    id: string
    nom: string
    joueur1: string
    joueur2: string
    tete_serie: number | null
    tableau: 'winners' | 'consolante' | null
    place_finale: number | null
    points_fft: number | null
  }
  matchsInitial: Match[]
  equipeInfos: Record<string, EquipeInfo>
  libelles: Record<string, { e1: string; e2: string }>
  feederRefs: Record<string, [FeederRef | null, FeederRef | null]>
  fourchettes: Record<string, { min: number; max: number } | null>
}

function formatHeure(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function TPlayer(props: Props) {
  const { code, tournoiId, tournoiNom, afficherPoints, equipe, equipeInfos, libelles, feederRefs, fourchettes } = props
  const [matchs, setMatchs] = useState<Match[]>(props.matchsInitial)
  const [statut, setStatut] = useState<StatutTournoi>(props.statut)
  const [placeFinale, setPlaceFinale] = useState<number | null>(equipe.place_finale)
  const [pointsFft, setPointsFft] = useState<number | null>(equipe.points_fft)
  const [tableau, setTableau] = useState(equipe.tableau)
  const [saisie, setSaisie] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const recharger = async () => {
      const [{ data: ms }, { data: eqRows }, { data: t }] = await Promise.all([
        supabase.from('matchs').select('*').eq('tournoi_id', tournoiId),
        supabase.rpc('get_equipe_by_code', { p_code: code }),
        supabase.from('tournois').select('statut').eq('id', tournoiId).single(),
      ])
      if (ms) setMatchs(ms as Match[])
      const e = (eqRows as Array<{ place_finale: number | null; points_fft: number | null; tableau: 'winners' | 'consolante' | null }> | null)?.[0]
      if (e) {
        setPlaceFinale(e.place_finale)
        setPointsFft(e.points_fft)
        setTableau(e.tableau)
      }
      if (t) setStatut(t.statut as StatutTournoi)
    }
    const channel = supabase
      .channel(`t-${equipe.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchs', filter: `tournoi_id=eq.${tournoiId}` }, recharger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournois', filter: `id=eq.${tournoiId}` }, recharger)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournoiId, code, equipe.id])

  // ── Matchs de l'équipe ─────────────────────────────────────────────────────
  const mesMatchs = matchs.filter((m) => (m.equipe1_id === equipe.id || m.equipe2_id === equipe.id) && !m.est_bye)
  const enCours = mesMatchs.find((m) => m.statut === 'en_cours') ?? null
  const prochain = mesMatchs
    .filter((m) => m.statut === 'en_attente' || m.statut === 'equipes_presentes')
    .sort((a, b) => (a.creneau ?? 0) - (b.creneau ?? 0))[0] ?? null
  const actif = enCours ?? prochain
  const historique = mesMatchs
    .filter((m) => m.statut === 'termine')
    .sort((a, b) => (a.creneau ?? 0) - (b.creneau ?? 0))

  // Adversaire d'un match donné (l'autre équipe).
  const adversaire = (m: Match) => {
    const cote: 1 | 2 = m.equipe1_id === equipe.id ? 1 : 2
    const advCote: 1 | 2 = cote === 1 ? 2 : 1
    const advId = advCote === 1 ? m.equipe1_id : m.equipe2_id
    if (advId && equipeInfos[advId]) {
      const e = equipeInfos[advId]
      return { connu: true as const, nom: e.nom, joueurs: `${e.joueur1} / ${e.joueur2}`, seed: e.tete_serie }
    }
    // Inconnu : libellé nourricier + équipes candidates si connues.
    const label = (advCote === 1 ? libelles[m.id]?.e1 : libelles[m.id]?.e2) ?? 'À déterminer'
    const refAdv = feederRefs[m.id]?.[advCote - 1] ?? null
    let candidats: string[] = []
    if (refAdv) {
      const f = matchs.find((x) => x.tableau === refAdv.tableau && x.tour === refAdv.tour && x.match_num === refAdv.match_num)
      if (f) {
        candidats = [f.equipe1_id, f.equipe2_id]
          .filter((id): id is string => id != null && equipeInfos[id] != null)
          .map((id) => equipeInfos[id].nom)
      }
    }
    return { connu: false as const, label, candidats }
  }

  // Chrono du match en cours SUR le terrain du prochain match (pour estimer la
  // libération) — seulement si ce n'est pas déjà notre match.
  const occupantTerrain =
    actif && actif.statut !== 'en_cours' && actif.terrain != null
      ? matchs.find((m) => m.terrain === actif.terrain && m.statut === 'en_cours' && m.id !== actif.id) ?? null
      : null

  const proposer = async (m: Match) => {
    const parsed = parseSaisieCombinee(saisie)
    if (!parsed) {
      setErreur('Format de score invalide. Exemple : 9-3')
      return
    }
    setBusy(true)
    setErreur(null)
    setInfo(null)
    const r = await proposerScore(tournoiId, m.id, code, parsed.s1, parsed.s2)
    setBusy(false)
    if (r.error) setErreur(r.error)
    else {
      setSaisie('')
      setInfo(
        r.statut === 'confirme'
          ? 'Score confirmé ✓'
          : r.statut === 'conteste'
            ? 'Score différent de l’adversaire — l’organisateur va trancher.'
            : 'Proposition envoyée. En attente de l’adversaire.'
      )
    }
  }

  // Bloc points indicatifs (précalculé serveur ; fourchette du match actif).
  const fourchette = actif ? fourchettes[actif.id] ?? null : null

  const propAdverse = (m: Match) => {
    const advCote: 1 | 2 = m.equipe1_id === equipe.id ? 2 : 1
    const advId = advCote === 1 ? m.equipe1_id : m.equipe2_id
    if (!advId) return null
    const p = m.propositions_score?.[advId]
    return p ? formatScoreSets(p.e1, p.e2) : null
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className="wordmark" style={{ fontSize: 16 }}>
          vamos
        </span>
        <span className={styles.tournoiNom}>{tournoiNom}</span>
      </header>

      <div className={styles.equipeCard}>
        <div className={styles.equipeNom}>
          {equipe.nom}
          {equipe.tete_serie != null && <span className={styles.seed}>TS{equipe.tete_serie}</span>}
        </div>
        <div className={styles.joueurs}>
          {equipe.joueur1} / {equipe.joueur2}
        </div>
        {tableau && <div className={styles.position}>{tableau === 'winners' ? 'Tableau principal' : 'Consolante'}</div>}
      </div>

      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {info && <p className={styles.info}>{info}</p>}

      {/* ── Fin de tournoi ─────────────────────────────────────────────── */}
      {placeFinale != null ? (
        <section className={styles.card}>
          <h2 className={styles.cardTitre}>Classement final</h2>
          <div className={styles.placeFinale}>{placeFinale}ᵉ place</div>
          {afficherPoints && pointsFft != null && (
            <div className={styles.pointsBloc}>
              <div className={styles.pointsVal}>{pointsFft} points</div>
              <div className={styles.pointsMention}>Indicatif — non transmis à la FFT</div>
            </div>
          )}
        </section>
      ) : (
        <>
          {/* ── Match en cours (l'équipe joue) → proposition de score ─────── */}
          {enCours && (
            <section className={`${styles.card} ${styles.cardLive}`}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitre}>Ton match — Terrain {enCours.terrain}</h2>
                {enCours.heure_debut && (
                  <span className={styles.chronoWrap}>
                    <LiveDot /> <ChronoLive startTime={enCours.heure_debut} />
                  </span>
                )}
              </div>
              <MatchLigne m={enCours} equipe={equipe} equipeInfos={equipeInfos} adversaire={adversaire} />

              <div className={styles.scoreZone}>
                <label className={styles.scoreLabel}>
                  Saisis les jeux de <strong>{equipeInfos[enCours.equipe1_id!]?.nom ?? 'l’équipe 1'}</strong> en
                  premier
                </label>
                <div className={styles.scoreForm}>
                  <input
                    className="form-input"
                    inputMode="numeric"
                    placeholder="9-3"
                    value={saisie}
                    onChange={(e) => setSaisie(e.target.value)}
                    disabled={busy}
                  />
                  <LiquidButton variant="primary" type="button" disabled={busy} onClick={() => proposer(enCours)}>
                    Proposer
                  </LiquidButton>
                </div>
                {propAdverse(enCours) && (
                  <p className={styles.propAdverse}>
                    Adversaire a proposé : <strong>{propAdverse(enCours)}</strong>
                    {enCours.statut_score === 'conteste' && ' — désaccord, l’organisateur va trancher.'}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ── Prochain match ────────────────────────────────────────────── */}
          {!enCours && prochain && (
            <section className={styles.card}>
              <h2 className={styles.cardTitre}>Ton prochain match</h2>
              <div className={styles.prochainMeta}>
                <span className={styles.terrainBig}>Terrain {prochain.terrain}</span>
                <span className={styles.etaBig}>~ {formatHeure(prochain.heure_convocation_estimee)}</span>
              </div>
              <MatchLigne m={prochain} equipe={equipe} equipeInfos={equipeInfos} adversaire={adversaire} />
              {occupantTerrain?.heure_debut && (
                <p className={styles.terrainOccupe}>
                  Terrain {prochain.terrain} occupé —{' '}
                  <span className={styles.chronoInline}>
                    <ChronoLive startTime={occupantTerrain.heure_debut} />
                  </span>{' '}
                  de jeu
                </p>
              )}
            </section>
          )}

          {!enCours && !prochain && statut !== 'termine' && (
            <section className={styles.card}>
              <p className={styles.vide}>Aucun match à venir pour le moment.</p>
            </section>
          )}

          {/* ── Points indicatifs ─────────────────────────────────────────── */}
          {afficherPoints && fourchette && (
            <section className={styles.card}>
              <h2 className={styles.cardTitre}>Points en jeu</h2>
              <div className={styles.pointsBloc}>
                <div className={styles.pointsVal}>
                  Entre {fourchette.min} et {fourchette.max} points
                </div>
                <div className={styles.pointsMention}>Indicatif — non transmis à la FFT</div>
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Historique ──────────────────────────────────────────────────── */}
      {historique.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitre}>Tes matchs</h2>
          <div className={styles.histoList}>
            {historique.map((m) => {
              const cote: 1 | 2 = m.equipe1_id === equipe.id ? 1 : 2
              const gagne = m.gagnant_id === equipe.id
              const adv = adversaire(m)
              return (
                <div key={m.id} className={styles.histoItem}>
                  <span className={`${styles.histoRes} ${gagne ? styles.histoWin : styles.histoLose}`}>
                    {gagne ? 'V' : 'D'}
                  </span>
                  <span className={styles.histoAdv}>{adv.connu ? adv.nom : 'Adversaire'}</span>
                  <span className={styles.histoScore}>
                    {cote === 1
                      ? formatScoreSets(m.score_equipe1, m.score_equipe2)
                      : formatScoreSets(m.score_equipe2, m.score_equipe1)}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}

// Ligne « Toi vs Adversaire » réutilisée dans match en cours / prochain.
function MatchLigne({
  m,
  equipe,
  equipeInfos,
  adversaire,
}: {
  m: Match
  equipe: Props['equipe']
  equipeInfos: Record<string, EquipeInfo>
  adversaire: (m: Match) => { connu: true; nom: string; joueurs: string; seed: number | null } | { connu: false; label: string; candidats: string[] }
}) {
  const adv = adversaire(m)
  return (
    <div className={styles.matchLigne}>
      <div className={styles.cote}>
        <span className={styles.coteToi}>Toi</span>
        <span className={styles.coteNom}>{equipe.joueur1} / {equipe.joueur2}</span>
      </div>
      <span className={styles.vs}>vs</span>
      <div className={styles.cote}>
        {adv.connu ? (
          <>
            <span className={styles.coteNom}>
              {adv.nom}
              {adv.seed != null && <span className={styles.seed}>TS{adv.seed}</span>}
            </span>
            <span className={styles.coteJoueurs}>{adv.joueurs}</span>
          </>
        ) : (
          <>
            <span className={styles.coteInconnu}>{adv.label}</span>
            {adv.candidats.length > 0 && (
              <span className={styles.candidats}>{adv.candidats.join(' ou ')}</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
