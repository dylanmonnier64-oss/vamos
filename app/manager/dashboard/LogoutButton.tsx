'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LiquidButton from '@/components/ui/LiquidButton'
import { t } from '@/lib/i18n'

// Déconnexion : supabase.auth.signOut() côté navigateur puis retour au login.
// router.refresh() force le middleware/serveur à réévaluer la session (sinon
// la page en cache pourrait rester "connectée" au retour arrière).
export default function LogoutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/manager/login')
      router.refresh()
    })
  }

  return (
    <LiquidButton variant="secondary" type="button" onClick={handleLogout} disabled={isPending}>
      {isPending ? t('dashboard.deconnexionEnCours') : t('dashboard.deconnexion')}
    </LiquidButton>
  )
}
