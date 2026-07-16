'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Lance le tournoi : passe `tournois.statut` de 'setup' à 'en_cours'.
 *
 * Le filtre `.eq('statut', 'setup')` garantit l'idempotence : on ne relance
 * pas un tournoi déjà en cours ou terminé. La RLS restreint déjà la mise à
 * jour à l'organisation du manager connecté.
 *
 * Aucun envoi SMS/email ici (aucun fournisseur branché — trou connu du
 * projet) : après lancement, la page bracket affiche les codes d'accès et les
 * liens /t/[code] pour communication manuelle.
 */
export async function lancerTournoi(tournoiId: string): Promise<{ error: string } | void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/manager/login')
  }

  const { error } = await supabase
    .from('tournois')
    .update({ statut: 'en_cours' })
    .eq('id', tournoiId)
    .eq('statut', 'setup')

  if (error) {
    return { error: `Impossible de lancer le tournoi : ${error.message}` }
  }

  revalidatePath(`/manager/tournoi/${tournoiId}/bracket`)
}
