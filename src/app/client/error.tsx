'use client'

import RouteError from '@/components/shared/RouteError'

export default function ClientPortalError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteError {...props} message="Impossible de charger cette page. Réessayez dans un moment." />
}
