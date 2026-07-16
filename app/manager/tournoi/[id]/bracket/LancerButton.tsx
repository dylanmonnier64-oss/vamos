'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import LiquidButton from '@/components/ui/LiquidButton'
import { lancerTournoi } from './actions'

// Bouton "Lancer le tournoi" (visible uniquement en statut 'setup'). Appelle
// la Server Action puis rafraîchit la page (le statut passe à 'en_cours', les
// codes d'accès apparaissent).
export default function LancerButton({ tournoiId }: { tournoiId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  function handleLancer() {
    setErreur(null)
    startTransition(async () => {
      const res = await lancerTournoi(tournoiId)
      if (res?.error) {
        setErreur(res.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <>
      <LiquidButton variant="primary" type="button" onClick={handleLancer} disabled={isPending}>
        {isPending ? 'Lancement…' : 'Lancer le tournoi →'}
      </LiquidButton>
      {erreur && (
        <p className="form-error" role="alert" style={{ margin: 0, textAlign: 'right' }}>
          {erreur}
        </p>
      )}
    </>
  )
}
