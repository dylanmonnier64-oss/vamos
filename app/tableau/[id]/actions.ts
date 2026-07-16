'use server'

import { recalculerETA } from '@/lib/eta'

// Recalcul d'ETA déclenché depuis l'écran public après un démarrage joueur.
// recalculerETA lit les matchs (SELECT anon) et écrit via la RPC maj_eta
// (SECURITY DEFINER, granted anon) — fonctionne donc sans session manager.
// Réservé au format élimination (les autres formats n'ont pas d'ETA nourricier).
export async function rafraichirEta(tournoiId: string): Promise<void> {
  await recalculerETA(tournoiId)
}
