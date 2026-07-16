'use client'

import { useRouter } from 'next/navigation'
import LiquidButton from '@/components/ui/LiquidButton'
import { t } from '@/lib/i18n'

// Bouton primaire "+ Nouveau tournoi" — navigation vers le stepper. Client
// (onClick) car LiquidButton rend un <button> : on ne peut pas l'imbriquer
// dans un <Link> (a > button invalide), on route donc via useRouter.
export default function NewTournoiButton() {
  const router = useRouter()
  return (
    <LiquidButton variant="primary" type="button" onClick={() => router.push('/manager/tournoi/new')}>
      {t('dashboard.nouveauTournoi')}
    </LiquidButton>
  )
}
