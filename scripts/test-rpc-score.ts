// ============================================================================
// Validation runtime de la phase 2 (§2.4) contre la VRAIE base Supabase.
// Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env.local (test-only, non commité) :
// on crée un tournoi de test avec des codes d'équipe connus, on exerce la RPC
// proposer_score + la progression, puis on NETTOIE tout. Les appels « joueur »
// passent par la clé ANON (comme un vrai joueur) ; le service_role ne sert qu'au
// setup/teardown que l'anon ne peut pas faire (RLS).
//
//   npx tsx scripts/test-rpc-score.ts
// ============================================================================

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { initialiserTournoi } from '../lib/bracket'
import { construireMajDepuisScore } from '../lib/progression'
import type { Equipe, Match, Tournoi } from '../lib/supabase/database.types'

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const get = (k: string) => env.split('\n').find((l) => l.startsWith(k + '='))?.slice(k.length + 1).trim() ?? ''
const URL_SB = get('NEXT_PUBLIC_SUPABASE_URL')
const ANON = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const SERVICE = get('SUPABASE_SERVICE_ROLE_KEY')
const TEST_MODE = get('SUPABASE_TEST_MODE')

// GARDE anti-prod : ce harnais CRÉE et supprime un tournoi dans la base pointée
// par NEXT_PUBLIC_SUPABASE_URL. Tant que cette base n'est pas explicitement
// marquée comme environnement de test (SUPABASE_TEST_MODE=true, portée seulement
// par le .env.local local, absente en prod/CI), on NE touche à rien. Le vrai
// correctif — un projet Supabase de test séparé — est noté pour le pré-vente.
if (TEST_MODE !== 'true') {
  console.log('⏭  SUPABASE_TEST_MODE ≠ true → harnais RPC SAUTÉ (aucune écriture en base).')
  console.log('   Pour l\'exécuter contre un environnement de test explicite, ajoute')
  console.log('   SUPABASE_TEST_MODE=true dans .env.local (jamais en prod/CI).')
  process.exit(0)
}

if (!SERVICE) {
  console.log('⚠  SUPABASE_SERVICE_ROLE_KEY absent de .env.local.')
  console.log('   Récupère-le dans Supabase > Settings > API > service_role, ajoute :')
  console.log('   SUPABASE_SERVICE_ROLE_KEY=eyJ...   (ne pas commiter)')
  process.exit(1)
}

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false } })
const anon = createClient(URL_SB, ANON, { auth: { persistSession: false } })

let ok = 0
let ko = 0
function check(nom: string, cond: boolean, detail = '') {
  if (cond) {
    ok++
    console.log(`  [PASS] ${nom}`)
  } else {
    ko++
    console.log(`  [FAIL] ${nom}  ${detail}`)
  }
}
const errMsg = (e: { message: string } | null) => e?.message ?? ''

const HEURE = '2026-07-14T09:00:00.000Z'
const N = 6
const C = 2

async function proposer(matchId: string, code: string, s1: string, s2: string) {
  return anon.rpc('proposer_score', {
    p_match_id: matchId,
    p_code_acces: code,
    p_score_equipe1: s1,
    p_score_equipe2: s2,
  })
}

async function main() {
  // 0008 appliquée ?
  const { error: colErr } = await admin.from('matchs').select('propositions_score').limit(1)
  if (colErr) {
    console.log('⚠  Migration 0008 non appliquée (propositions_score absente). Colle-la d\'abord.')
    process.exit(1)
  }

  const { data: orgs } = await admin.from('organisations').select('id').limit(1)
  if (!orgs?.length) {
    console.log('⚠  Aucune organisation en base pour rattacher le tournoi de test.')
    process.exit(1)
  }
  const orgId = orgs[0].id as string
  const tid = randomUUID()

  console.log('================ PHASE 2 — validation runtime (§2.4) ================')
  console.log(`Tournoi de test : ${N} équipes / ${C} terrains — ${tid}`)

  try {
    // ── SETUP ────────────────────────────────────────────────────────────
    await admin.from('tournois').insert({
      id: tid,
      organisation_id: orgId,
      nom: 'ZZ TEST RPC (auto)',
      date: '2026-07-14',
      format: 'elimination',
      categorie_fft: 'P100',
      nb_equipes: N,
      nb_terrains: C,
      heure_debut: HEURE,
      duree_match_minutes: 45,
      statut: 'setup',
    })

    const equipes: Equipe[] = Array.from({ length: N }, (_, i) => ({
      id: randomUUID(),
      tournoi_id: tid,
      nom: `ZTeam ${i + 1}`,
      joueur1: 'A',
      joueur2: 'B',
      code_acces: `ZTST${String(i + 1).padStart(2, '0')}`, // 6 car., ex. ZTST01
      tete_serie: i < 4 ? i + 1 : null,
      tableau: null,
      place_finale: null,
      points_fft: null,
      created_at: HEURE,
    }))
    await admin.from('equipes').insert(
      equipes.map((e) => ({
        id: e.id,
        tournoi_id: e.tournoi_id,
        nom: e.nom,
        joueur1: e.joueur1,
        joueur2: e.joueur2,
        code_acces: e.code_acces,
        tete_serie: e.tete_serie,
      }))
    )
    const codeDe = new Map(equipes.map((e) => [e.id, e.code_acces]))

    const { matchs: plan } = initialiserTournoi(
      { id: tid, nb_equipes: N, nb_terrains: C, heure_debut: HEURE, duree_match_minutes: 45 },
      equipes
    )
    const { error: insErr } = await admin.from('matchs').insert(plan)
    if (insErr) throw new Error(`insert matchs: ${insErr.message}`)

    const recharger = async () => {
      const { data } = await admin.from('matchs').select('*').eq('tournoi_id', tid)
      return (data ?? []) as Match[]
    }
    let matchs = await recharger()

    const w1 = matchs.filter((m) => m.tableau === 'winners' && m.tour === 1)
    const matchReel = w1.find((m) => !m.est_bye && m.equipe1_id && m.equipe2_id)!
    const matchBye = w1.find((m) => m.est_bye)
    const codeA = codeDe.get(matchReel.equipe1_id!)!
    const codeB = codeDe.get(matchReel.equipe2_id!)!
    // Code d'une équipe d'un AUTRE match.
    const autre = w1.find((m) => m.id !== matchReel.id && !m.est_bye && m.equipe1_id)!
    const codeEtranger = codeDe.get(autre.equipe1_id!)!

    // ── Test 3 (avant lancement) : tournoi non démarré → rejet ───────────
    {
      const { error } = await proposer(matchReel.id, codeA, '6', '4')
      check('proposition sur tournoi non démarré → rejetée', /pas encore d/i.test(errMsg(error)), errMsg(error))
    }

    // Lancement + on met le match réel en_cours (le manager/joueur le lancerait).
    await admin.from('tournois').update({ statut: 'en_cours' }).eq('id', tid)
    await admin.from('matchs').update({ statut: 'en_cours', heure_debut: HEURE }).eq('id', matchReel.id)

    // ── Test 1 : code inexistant → rejet ─────────────────────────────────
    {
      const { error } = await proposer(matchReel.id, 'ZZZZZZ', '6', '4')
      check('code inexistant → rejeté', /invalide pour ce match/i.test(errMsg(error)), errMsg(error))
    }
    // ── Test 2 : code valide mais d'un AUTRE match → rejet ───────────────
    {
      const { error } = await proposer(matchReel.id, codeEtranger, '6', '4')
      check('code d\'une équipe d\'un autre match → rejeté', /invalide pour ce match/i.test(errMsg(error)), errMsg(error))
    }

    // ── Test bye : proposer sur un bye (forcé en_cours) → rejet ──────────
    if (matchBye && matchBye.equipe1_id) {
      await admin.from('matchs').update({ statut: 'en_cours' }).eq('id', matchBye.id)
      const codeBye = codeDe.get(matchBye.equipe1_id)!
      const { error } = await proposer(matchBye.id, codeBye, '6', '4')
      check('proposition sur un bye → rejetée', /bye/i.test(errMsg(error)), errMsg(error))
      await admin.from('matchs').update({ statut: 'termine' }).eq('id', matchBye.id)
    } else {
      console.log('  [skip] pas de bye avec équipe dans ce tirage')
    }

    // ── Test 6 : re-proposition écrase sa propre proposition ─────────────
    {
      await proposer(matchReel.id, codeA, '9', '3') // A propose X
      await proposer(matchReel.id, codeA, '9', '7') // A se corrige → Y
      const m = (await recharger()).find((x) => x.id === matchReel.id)!
      const propA = m.propositions_score[matchReel.equipe1_id!]
      check(
        're-proposition d\'une équipe écrase la sienne (statut propose)',
        m.statut_score === 'propose' && propA?.e1 === '9' && propA?.e2 === '7',
        JSON.stringify({ statut: m.statut_score, propA })
      )
    }

    // ── Test 5 : deux scores différents → conteste, non entériné ─────────
    {
      await proposer(matchReel.id, codeB, '9', '8') // B propose un score différent
      const m = (await recharger()).find((x) => x.id === matchReel.id)!
      check(
        'deux scores différents → conteste, match en_cours, score non entériné',
        m.statut_score === 'conteste' && m.statut === 'en_cours' && m.score_equipe1 == null,
        JSON.stringify({ statut_score: m.statut_score, statut: m.statut, score1: m.score_equipe1 })
      )
    }

    // ── Test 4 : deux scores identiques → confirme + progression ─────────
    {
      // Les deux équipes proposent le MÊME score (A d'abord re-propose Z, puis B).
      await proposer(matchReel.id, codeA, '9', '3')
      const r = await proposer(matchReel.id, codeB, '9', '3')
      const rjson = r.data as { statut_score: string; confirme: boolean } | null
      const m = (await recharger()).find((x) => x.id === matchReel.id)!
      check(
        'deux scores identiques → confirme + match termine',
        rjson?.confirme === true && m.statut_score === 'confirme' && m.statut === 'termine' && m.score_equipe1 === '9',
        JSON.stringify({ rjson, statut: m.statut, statut_score: m.statut_score })
      )

      // L'appelant applicatif : onScoreSaisi (TS) → progresser_bracket (RPC anon).
      matchs = await recharger()
      const tournoi = { nb_equipes: N, categorie_fft: 'P100' } as Pick<Tournoi, 'nb_equipes' | 'categorie_fft'>
      const maj = construireMajDepuisScore(matchs, tournoi, matchReel.id, '9', '3')
      if ('erreur' in maj) {
        check('progression : construireMajDepuisScore OK', false, maj.erreur)
      } else {
        const { error: pErr } = await anon.rpc('progresser_bracket', {
          p_match_id: matchReel.id,
          p_code_acces: codeA,
          p_maj: maj.maj,
        })
        check('progresser_bracket accepté (code + score confirmé)', !pErr, errMsg(pErr))

        matchs = await recharger()
        const gagnant = maj.gagnantId
        const gagnantDansTour2 = matchs.some(
          (x) => x.tableau === 'winners' && x.tour === 2 && (x.equipe1_id === gagnant || x.equipe2_id === gagnant)
        )
        check('le vainqueur remonte dans un match du tour 2 winners', gagnantDansTour2, `gagnant=${gagnant}`)

        // Le perdant tombe en consolante (vague 1).
        const perdant = gagnant === matchReel.equipe1_id ? matchReel.equipe2_id : matchReel.equipe1_id
        const perdantEnConso = matchs.some(
          (x) => x.tableau === 'consolante' && (x.equipe1_id === perdant || x.equipe2_id === perdant)
        )
        check('le perdant tombe en consolante', perdantEnConso, `perdant=${perdant}`)
      }
    }

    // ── Garde progresser_bracket : score non confirmé → rejet ────────────
    {
      const cible = w1.find((m) => m.id !== matchReel.id && !m.est_bye && m.equipe1_id)!
      const code = codeDe.get(cible.equipe1_id!)!
      const { error } = await anon.rpc('progresser_bracket', {
        p_match_id: cible.id,
        p_code_acces: code,
        p_maj: { matchs: [], equipes: [], tournoi_termine: false },
      })
      check('progresser_bracket sur score non confirmé → rejeté', /pas confirm/i.test(errMsg(error)), errMsg(error))
    }
  } finally {
    // ── TEARDOWN ─────────────────────────────────────────────────────────
    await admin.from('matchs').delete().eq('tournoi_id', tid)
    await admin.from('equipes').delete().eq('tournoi_id', tid)
    await admin.from('tournois').delete().eq('id', tid)
    console.log('  (nettoyage : tournoi de test supprimé)')
  }

  console.log('================ RÉSULTAT ================')
  console.log(ko === 0 ? `  ✓ ${ok} tests PASS` : `  ✗ ${ko} FAIL / ${ok + ko}`)
  process.exit(ko === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
