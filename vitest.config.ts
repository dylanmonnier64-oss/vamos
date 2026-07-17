import { defineConfig } from 'vitest/config'

// Filet de tests VAMOS. Environnement node (modules purs + scripts DB) ; les
// tests sont dans tests/. Les tests RPC (tests/rpc.test.ts) touchent la vraie
// base et se sautent tout seuls si SUPABASE_SERVICE_ROLE_KEY est absent.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
