'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { t } from '@/lib/i18n'

/**
 * Connexion manager — exécutée côté serveur (Server Action).
 *
 * Pourquoi une Server Action plutôt que signInWithPassword côté navigateur +
 * router.push : ici la pose du cookie de session ET le redirect se font dans
 * le MÊME aller-retour serveur. Le cookie part avec la réponse, puis la
 * navigation vers /manager/dashboard le présente au middleware → aucune course
 * client/serveur possible (le bug "reste sur /manager/login" venait de là).
 *
 * Retourne `{ error }` en cas d'échec (affiché sur le login) ; en cas de
 * succès, `redirect()` interrompt l'exécution et déclenche la navigation.
 */
export async function connexion(
  email: string,
  password: string
): Promise<{ error: string } | void> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Message réel de Supabase (ex: "Email not confirmed", "Invalid login
    // credentials") pour que le manager puisse diagnostiquer.
    return { error: error.message || t('login.erreurGenerique') }
  }

  redirect('/manager/dashboard')
}
