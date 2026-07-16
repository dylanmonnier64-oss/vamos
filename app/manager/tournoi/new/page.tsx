'use client'

import { useState, useTransition } from 'react'
import GlassCard from '@/components/ui/GlassCard'
import LiquidButton from '@/components/ui/LiquidButton'
import { parseEquipes, type EquipeSaisie } from '@/lib/equipes'
import type { CategorieFft } from '@/lib/supabase/database.types'
import { t } from '@/lib/i18n'
import { creerTournoi } from './actions'
import styles from './stepper.module.css'

const CATEGORIES: CategorieFft[] = ['P25', 'P50', 'P100', 'P250', 'P500', 'P1000', 'P1500']

export default function NouveauTournoiPage() {
  const [etape, setEtape] = useState<1 | 2 | 3>(1)
  const [isPending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [date, setDate] = useState('')
  const [heure, setHeure] = useState('10:00')
  const [format, setFormat] = useState<'elimination' | 'team_americano'>('elimination')
  const [categorie, setCategorie] = useState<CategorieFft>('P100')
  const [afficherPoints, setAfficherPoints] = useState(true)
  const [pointsParMatch, setPointsParMatch] = useState(24)
  const [nbRounds, setNbRounds] = useState('') // texte pour autoriser « vide » = complet
  const [nbTerrains, setNbTerrains] = useState(2)
  const [nbEquipes, setNbEquipes] = useState(8)
  // Durée d'un match : plus demandée dans l'UI (remplacée par le nombre
  // d'équipes), mais toujours nécessaire à initialiserTournoi pour calculer les
  // horaires de convocation → valeur par défaut fixe.
  const dureeMatch = 60
  const [equipesTexte, setEquipesTexte] = useState('')
  const [tetesDeSerie, setTetesDeSerie] = useState<Record<number, number>>({})

  // Échange de joueurs entre paires. Le texte reste la source de vérité :
  // `equipesEditees` est un calque optionnel par-dessus le parsing. `null` =
  // aucun échange, on affiche le parsing brut. Toute modif du texte ou un clic
  // sur "Réinitialiser les paires" abandonne le calque.
  const [equipesEditees, setEquipesEditees] = useState<EquipeSaisie[] | null>(null)
  const [selection, setSelection] = useState<{ paire: number; slot: 'joueur1' | 'joueur2' } | null>(
    null
  )

  const { equipes, lignesInvalides } = parseEquipes(equipesTexte)
  // Liste réellement affichée et soumise (post-échanges si présents).
  const equipesAffichees = equipesEditees ?? equipes

  function handleTexteChange(valeur: string) {
    setEquipesTexte(valeur)
    // Le texte redevient la source de vérité : on jette les échanges en cours.
    setEquipesEditees(null)
    setSelection(null)
  }

  function handleNomClick(paire: number, slot: 'joueur1' | 'joueur2') {
    // Premier clic → sélectionne.
    if (!selection) {
      setSelection({ paire, slot })
      return
    }
    // Reclic sur le même joueur → annule sans échanger.
    if (selection.paire === paire && selection.slot === slot) {
      setSelection(null)
      return
    }
    // Second clic sur un autre joueur → échange les deux noms. On échange des
    // noms, pas des paires : le nombre de paires ne change pas, donc les index
    // de têtes de série restent valides.
    const base = equipesEditees ?? equipes
    const next = base.map((e) => ({ ...e }))
    const tmp = next[selection.paire][selection.slot]
    next[selection.paire][selection.slot] = next[paire][slot]
    next[paire][slot] = tmp
    setEquipesEditees(next)
    setSelection(null)
  }

  function reinitialiserPaires() {
    setEquipesEditees(null)
    setSelection(null)
  }

  function setTeteDeSerie(index: number, rang: number | null) {
    setTetesDeSerie((prev) => {
      const next: Record<number, number> = {}
      // Un rang ne peut être porté que par une seule équipe à la fois.
      for (const [key, value] of Object.entries(prev)) {
        if (value !== rang) next[Number(key)] = value
      }
      if (rang !== null) next[index] = rang
      return next
    })
  }

  function allerEtape(cible: 1 | 2 | 3) {
    setErreur(null)
    setEtape(cible)
  }

  function handleSuivant() {
    setErreur(null)
    if (etape === 1) {
      if (!nom.trim()) return setErreur(t('stepper.errNom'))
      if (!date) return setErreur(t('stepper.errDate'))
      if (nbEquipes < 2) return setErreur(t('stepper.errMin2'))
    }
    if (etape === 2) {
      if (lignesInvalides.length > 0) {
        return setErreur(t('stepper.errLigne', { ligne: lignesInvalides[0] }))
      }
      if (equipes.length < 2) return setErreur(t('stepper.errMin2'))
      // Le nombre d'équipes annoncé à l'étape 1 fait foi : la liste saisie doit
      // correspondre exactement.
      if (equipesAffichees.length !== nbEquipes) {
        return setErreur(
          t('stepper.errNbEquipes', {
            attendu: nbEquipes,
            sAttendu: nbEquipes > 1 ? 's' : '',
            saisi: equipesAffichees.length,
            verbe: t(equipesAffichees.length > 1 ? 'stepper.errVerbePluriel' : 'stepper.errVerbeSing'),
          })
        )
      }
    }
    setEtape((e) => (e < 3 ? ((e + 1) as 1 | 2 | 3) : e))
  }

  function handlePrecedent() {
    setErreur(null)
    setEtape((e) => (e > 1 ? ((e - 1) as 1 | 2 | 3) : e))
  }

  function handleCreer() {
    setErreur(null)
    startTransition(async () => {
      try {
        await creerTournoi({
          nom,
          date,
          heure,
          format,
          categorie_fft: format === 'elimination' ? categorie : null,
          points_par_match: format === 'team_americano' ? pointsParMatch : null,
          nb_rounds: format === 'team_americano' && nbRounds ? Number(nbRounds) : null,
          nb_terrains: nbTerrains,
          duree_match_minutes: dureeMatch,
          equipesTexte,
          equipes: equipesAffichees,
          tetesDeSerie,
          afficher_points_indicatifs: format === 'elimination' ? afficherPoints : true,
        })
      } catch (e) {
        // redirect() lève une erreur interne Next.js reconnue par le
        // runtime avant d'arriver ici dans le cas de succès — seules les
        // vraies erreurs applicatives (throw explicite dans l'action)
        // finissent dans ce catch.
        setErreur(e instanceof Error ? e.message : t('stepper.errGenerique'))
      }
    })
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <span className="form-eyebrow">{t('stepper.eyebrow')}</span>
        <div className={styles.steps}>
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => (n < etape ? allerEtape(n) : undefined)}
              className={`${styles.stepPill} ${etape === n ? styles.stepPillActive : ''} ${
                etape > n ? styles.stepPillDone : ''
              }`}
              style={{ cursor: n < etape ? 'pointer' : 'default' }}
            >
              {n} · {n === 1 ? t('stepper.etapeInfos') : n === 2 ? t('stepper.etapeEquipes') : t('stepper.etapeRecap')}
            </button>
          ))}
        </div>
      </div>

      <GlassCard className={styles.card}>
        {etape === 1 && (
          <div className={styles.fields}>
            <div className="form-group">
              <label className="form-label" htmlFor="nom">
                {t('stepper.nom')}
              </label>
              <input
                id="nom"
                className="form-input"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder={t('stepper.nomPlaceholder')}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="format">
                {t('stepper.format')}
              </label>
              <select
                id="format"
                className="form-select"
                value={format}
                onChange={(e) => setFormat(e.target.value as 'elimination' | 'team_americano')}
              >
                <option value="elimination">{t('stepper.formatElimination')}</option>
                <option value="team_americano">{t('stepper.formatTeamAmericano')}</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="date">
                  {t('stepper.date')}
                </label>
                <input
                  id="date"
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="heure">
                  {t('stepper.heure')}
                </label>
                <input
                  id="heure"
                  type="time"
                  className="form-input"
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              {format === 'elimination' ? (
                <div className="form-group">
                  <label className="form-label" htmlFor="categorie">
                    {t('stepper.categorie')}
                  </label>
                  <select
                    id="categorie"
                    className="form-select"
                    value={categorie}
                    onChange={(e) => setCategorie(e.target.value as CategorieFft)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label" htmlFor="pointsCible">
                    {t('stepper.pointsCible')}
                  </label>
                  <select
                    id="pointsCible"
                    className="form-select"
                    value={pointsParMatch}
                    onChange={(e) => setPointsParMatch(Number(e.target.value))}
                  >
                    {[16, 20, 24, 32].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="terrains">
                  {t('stepper.nbTerrains')}
                </label>
                <input
                  id="terrains"
                  type="number"
                  min={1}
                  className="form-input"
                  value={nbTerrains}
                  onChange={(e) => setNbTerrains(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="nbEquipes">
                  {t('stepper.nbEquipes')}
                </label>
                <input
                  id="nbEquipes"
                  type="number"
                  min={2}
                  className="form-input"
                  value={nbEquipes}
                  onChange={(e) => setNbEquipes(Number(e.target.value))}
                />
              </div>
              {format === 'team_americano' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="nbRounds">
                    {t('stepper.nbRoundsLabel')}
                  </label>
                  <input
                    id="nbRounds"
                    type="number"
                    min={1}
                    className="form-input"
                    value={nbRounds}
                    onChange={(e) => setNbRounds(e.target.value)}
                    placeholder={t('stepper.nbRoundsHint')}
                  />
                </div>
              )}
            </div>
            {format === 'elimination' && (
              <div className="form-group">
                <label
                  className="form-label"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={afficherPoints}
                    onChange={(e) => setAfficherPoints(e.target.checked)}
                  />
                  Afficher les points indicatifs aux joueurs
                </label>
                <p className="form-hint">
                  Fourchette de points FFT « pour info » dans l&apos;espace joueur. Toujours signalée
                  comme non transmise à la FFT.
                </p>
              </div>
            )}
          </div>
        )}

        {etape === 2 && (
          <div className={styles.fields}>
            <div className="form-group">
              <label className="form-label" htmlFor="equipes">
                {t('stepper.equipesLabel')}
              </label>
              <textarea
                id="equipes"
                className="form-textarea"
                value={equipesTexte}
                onChange={(e) => handleTexteChange(e.target.value)}
                placeholder={t('stepper.equipesPlaceholder')}
                rows={10}
              />
              <span
                className="form-hint"
                style={
                  equipesAffichees.length === nbEquipes
                    ? { color: 'var(--copper-accent)' }
                    : undefined
                }
              >
                {t('stepper.equipesSaisies', {
                  saisi: equipesAffichees.length,
                  total: nbEquipes,
                  sTotal: nbEquipes > 1 ? 's' : '',
                  sSaisi: equipesAffichees.length > 1 ? 's' : '',
                })}
                {equipesAffichees.length === nbEquipes && t('stepper.equipesSaisiesOk')}
                {lignesInvalides.length > 0 &&
                  t('stepper.lignesIllisibles', { n: lignesInvalides.length })}
              </span>
            </div>

            {equipesAffichees.length > 0 && (
              <div className="form-group">
                <div className={styles.equipesHead}>
                  <span className="form-eyebrow">{t('stepper.tetesDeSerie')}</span>
                  {equipesEditees !== null && (
                    <button type="button" className={styles.resetLink} onClick={reinitialiserPaires}>
                      {t('stepper.reinitialiser')}
                    </button>
                  )}
                </div>
                <p className="form-hint">{t('stepper.echangeAstuce')}</p>
                <div className={styles.equipesListe}>
                  {equipesAffichees.map((eq, i) => (
                    <div key={i} className={styles.equipeRow}>
                      <span className={styles.equipePaire}>
                        {(['joueur1', 'joueur2'] as const).map((slot, s) => {
                          const estSelectionne =
                            selection?.paire === i && selection?.slot === slot
                          return (
                            <span key={slot} style={{ display: 'contents' }}>
                              {s === 1 && <span className={styles.sep}>/</span>}
                              <button
                                type="button"
                                onClick={() => handleNomClick(i, slot)}
                                className={`${styles.joueurBtn} ${
                                  estSelectionne ? styles.joueurBtnSelected : ''
                                }`.trim()}
                                aria-pressed={estSelectionne}
                              >
                                {eq[slot]}
                              </button>
                            </span>
                          )
                        })}
                      </span>
                      <select
                        className="form-select"
                        value={tetesDeSerie[i] ?? ''}
                        onChange={(e) => setTeteDeSerie(i, e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">{t('stepper.rangAucun')}</option>
                        {[1, 2, 3, 4].map((rang) => (
                          <option
                            key={rang}
                            value={rang}
                            disabled={tetesDeSerie[i] !== rang && Object.values(tetesDeSerie).includes(rang)}
                          >
                            {t('stepper.teteSerieRang', { rang })}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {etape === 3 && (
          <div className={styles.fields}>
            <span className="form-eyebrow">{t('stepper.recapTitre')}</span>
            <div className={styles.recap}>
              <div>
                <span className={styles.recapLabel}>{t('stepper.recapTournoi')}</span>
                <span>{nom || t('stepper.recapVide')}</span>
              </div>
              <div>
                <span className={styles.recapLabel}>{t('stepper.recapDate')}</span>
                <span>
                  {t('stepper.recapDateValeur', { date: date || t('stepper.recapVide'), heure })}
                </span>
              </div>
              <div>
                <span className={styles.recapLabel}>{t('stepper.recapCategorie')}</span>
                <span>{categorie}</span>
              </div>
              <div>
                <span className={styles.recapLabel}>{t('stepper.recapEquipes')}</span>
                <span>{equipesAffichees.length}</span>
              </div>
              <div>
                <span className={styles.recapLabel}>{t('stepper.recapTerrains')}</span>
                <span>{nbTerrains}</span>
              </div>
              <div>
                <span className={styles.recapLabel}>{t('stepper.recapTetes')}</span>
                <span>{Object.keys(tetesDeSerie).length || t('stepper.recapAucune')}</span>
              </div>
            </div>
            <p className="form-hint">{t('stepper.recapNote')}</p>
          </div>
        )}

        {erreur && <p className="form-error">{erreur}</p>}

        <div className={styles.actions}>
          <div>
            {etape > 1 && (
              <LiquidButton variant="ghost" onClick={handlePrecedent} disabled={isPending} type="button">
                {t('stepper.precedent')}
              </LiquidButton>
            )}
          </div>
          <div>
            {etape < 3 && (
              <LiquidButton variant="primary" onClick={handleSuivant} type="button">
                {t('stepper.suivant')}
              </LiquidButton>
            )}
            {etape === 3 && (
              <LiquidButton variant="primary" onClick={handleCreer} disabled={isPending} type="button">
                {isPending ? t('stepper.creation') : t('stepper.creer')}
              </LiquidButton>
            )}
          </div>
        </div>
      </GlassCard>
    </main>
  )
}
