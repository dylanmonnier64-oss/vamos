import { describe, test, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Sécurité des RPC contre la VRAIE base (proposer_score / progresser_bracket /
// demarrer_match) : rejets (mauvais code, tournoi non démarré, code d'un autre
// match, bye) + confirme/conteste/progression. Ne se joue que si la clé
// service_role est présente en local (le harnais crée un tournoi de test et le
// nettoie). En CI sans clé → skip (les tests purs suffisent à garder le vert).
// N'active le harnais RPC que si la base est explicitement marquée comme
// environnement de test (SUPABASE_TEST_MODE=true) ET que la clé service_role est
// présente. Sinon → skip (jamais d'écriture en prod/CI par accident).
function harnaisRpcAutorise(): boolean {
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    return /^SUPABASE_SERVICE_ROLE_KEY=.+/m.test(env) && /^SUPABASE_TEST_MODE=true$/m.test(env)
  } catch {
    return false
  }
}

describe('sécurité RPC (base réelle)', () => {
  test.skipIf(!harnaisRpcAutorise())(
    'test-rpc-score : rejets + confirme/conteste/progression (11 vérifs)',
    () => {
      expect(() => execFileSync('npx', ['tsx', 'scripts/test-rpc-score.ts'], { stdio: 'pipe' })).not.toThrow()
    },
    60_000
  )
})
