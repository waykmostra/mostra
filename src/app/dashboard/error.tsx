'use client'

import RouteError from '@/components/shared/RouteError'

export default function DashboardError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteError {...props} />
}
