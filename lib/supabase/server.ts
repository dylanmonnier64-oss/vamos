import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// À utiliser dans les Server Components, Route Handlers et Server Actions
// de /manager/*. Le rafraîchissement de session est géré par middleware.ts,
// donc l'échec silencieux du setAll ici (Server Component en lecture seule)
// est normal et sans conséquence.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Appelé depuis un Server Component : la session est déjà
            // rafraîchie par le middleware, on peut ignorer.
          }
        },
      },
    }
  )
}
