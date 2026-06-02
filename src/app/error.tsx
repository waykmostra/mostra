'use client'

import RouteError from '@/components/shared/RouteError'

// Boundary racine : capture les erreurs des segments sans boundary plus proche
// (founder, finance, account…). Récupère automatiquement des erreurs de chunk
// après un déploiement.
export default function RootError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteError {...props} />
}
