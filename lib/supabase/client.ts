import { createBrowserClient } from '@supabase/ssr'

// À utiliser dans tout composant 'use client' (pages live, realtime, saisie
// de score...). Chaque appel réutilise la même config, pas besoin de
// singleton manuel côté navigateur.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
