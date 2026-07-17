'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import GlassCard from '@/components/ui/GlassCard'
import LiquidButton from '@/components/ui/LiquidButton'
import LiveDot from '@/components/ui/LiveDot'
import type { Match, StatutTournoi } from '@/lib/supabase/database.types'
import { checkinEquipe, demarrerDepuisCheckin } from './actions'
import styles from './checkin.module.css'

interface EquipeLite {
  id: string
  nom: string
  tete_serie: number | null
}
interface Props {
  tournoiId: string
  nom: string
  statut: StatutTournoi
  equipes: EquipeLite[]
  equipeNoms: Record<string, string>
  matchsInitial: Match[]
}

// Prochain match en attente (non-bye) d'une équipe.
function prochainMatch(matchs: Match[], equipeId: string): Match | undefined {
  return matchs
    .filter((m) => (m.equipe1_id === equipeId || m.equipe2_id === equipeId) && m.statut === 'en_attente' && !m.est_bye)
    .sort((a, b) => (a.creneau ?? 0) - (b.creneau ?? 0))[0]
}

// Copie PURE de filtrerLancables (inlinée — pas d'import serveur dans le bundle).
function lancablesSur(matchs: Match[]): Match[] {
  const occupes = new Set<number>()
  for (const m of matchs) if (m.statut === 'en_cours' && m.terrain != null) occupes.add(m.terrain)
  return matchs
    .filter(
      (m) =>
        m.statut === 'en_attente' &&
        m.est_bye === false &&
        m.equipe1_id != null &&
        m.equipe2_id != null &&
        m.terrain != null &&
        !occupes.has(m.terrain) &&
        m.equipe1_presente === true &&
        m.equipe2_presente === true
    )
    .sort((a, b) => (a.creneau ?? 0) - (b.creneau ?? 0))
}

export default function CheckinClient({ tournoiId, nom, statut, equipes, equipeNoms, matchsInitial }: Props) {
  const [matchs, setMatchs] = useState<Match[]>(matchsInitial)
  const [statutCourant, setStatutCourant] = useState<StatutTournoi>(statut)
  const [busy, setBusy] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const recharger = async () => {
      const { data } = await supabase.from('matchs').select('*').eq('tournoi_id', tournoiId)
      if (data) setMatchs(data as Match[])
    }
    const rechargerStatut = async () => {
      const { data } = await supabase.from('tournois').select('statut').eq('id', tournoiId).single()
      if (data) setStatutCourant(data.statut as StatutTournoi)
    }
    const channel = supabase
      .channel(`checkin-${tournoiId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matchs', filter: `tournoi_id=eq.${tournoiId}` }, recharger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournois', filter: `id=eq.${tournoiId}` }, rechargerStatut)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournoiId])

  const nomEquipe = (id: string | null) => (id ? equipeNoms[id] ?? '—' : '—')

  const toggle = async (equipeId: string, present: boolean) => {
    setBusy(equipeId)
    setErreur(null)
    const r = await checkinEquipe(tournoiId, equipeId, present)
    setBusy(null)
    if (r?.error) setErreur(r.error)
  }

  const lancer = async (matchId: string) => {
    setBusy(matchId)
    setErreur(null)
    const r = await demarrerDepuisCheckin(tournoiId, matchId)
    setBusy(null)
    if (r?.error) setErreur(r.error)
  }

  const lancables = lancablesSur(matchs)

  // État de chaque équipe : présente sur son prochain match, en cours, ou plus de match.
  const infoEquipe = (equipeId: string) => {
    const next = prochainMatch(matchs, equipeId)
    if (next) {
      const present = next.equipe1_id === equipeId ? next.equipe1_presente : next.equipe2_presente
      return { etat: 'attente' as const, present, terrain: next.terrain }
    }
    const enCours = matchs.some((m) => (m.equipe1_id === equipeId || m.equipe2_id === equipeId) && m.statut === 'en_cours')
    return { etat: enCours ? ('en_cours' as const) : ('hors' as const), present: false, terrain: null }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Link href={`/manager/tournoi/${tournoiId}/bracket`} className={styles.back}>
            ← Tableau
          </Link>
          <span className={styles.titre}>Check-in — {nom}</span>
        </div>
        <span className={styles.liveTag}>
          {statutCourant === 'en_cours' ? (
            <>
              <LiveDot /> En direct
            </>
          ) : (
            'Pas encore démarré'
          )}
        </span>
      </header>

      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {/* ── Matchs prêts à lancer (les deux équipes présentes) ─────────── */}
      {lancables.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitre}>Prêts à lancer</h2>
          <div className={styles.lancablesList}>
            {lancables.map((m) => (
              <GlassCard key={m.id} className={styles.lancableCard}>
                <div className={styles.lancableInfo}>
                  <span className={styles.terrainBadge}>Terrain {m.terrain}</span>
                  <span className={styles.lancableEquipes}>
                    {nomEquipe(m.equipe1_id)} <span className={styles.vs}>vs</span> {nomEquipe(m.equipe2_id)}
                  </span>
                </div>
                <LiquidButton variant="primary" type="button" disabled={busy === m.id} onClick={() => lancer(m.id)}>
                  Lancer le match
                </LiquidButton>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* ── Toutes les équipes ────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitre}>Équipes ({equipes.length})</h2>
        <div className={styles.equipesList}>
          {equipes.map((e) => {
            const info = infoEquipe(e.id)
            return (
              <div key={e.id} className={`${styles.equipeRow} ${info.present ? styles.equipeRowPresent : ''}`.trim()}>
                <span className={styles.equipeNom}>
                  {e.nom}
                  {e.tete_serie != null && <span className={styles.seed}>TS{e.tete_serie}</span>}
                </span>
                <span className={styles.equipeMeta}>
                  {info.etat === 'attente'
                    ? `Terrain ${info.terrain}`
                    : info.etat === 'en_cours'
                      ? 'en cours'
                      : 'aucun match à venir'}
                </span>
                {info.etat === 'attente' ? (
                  <LiquidButton
                    variant={info.present ? 'primary' : 'secondary'}
                    type="button"
                    disabled={busy === e.id}
                    onClick={() => toggle(e.id, !info.present)}
                  >
                    {info.present ? '✓ Présente' : 'Check-in'}
                  </LiquidButton>
                ) : (
                  <span className={styles.equipeMetaVide}>—</span>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
