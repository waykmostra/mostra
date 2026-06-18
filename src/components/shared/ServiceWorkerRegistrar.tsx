'use client'

import { useEffect } from 'react'
import { registerServiceWorker, isPushSupported } from '@/lib/push/client'

/**
 * Enregistre le service worker au chargement (nécessaire pour recevoir les
 * notifications push). Ne demande aucune permission — l'utilisateur active
 * les notifs depuis son compte. Rend null.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (isPushSupported()) {
      registerServiceWorker()
    }
  }, [])
  return null
}
