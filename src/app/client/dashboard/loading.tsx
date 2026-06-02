import { Skeleton } from '@/components/shared/Skeleton'

export default function ClientDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[#1a1a1a] pb-0">
        <Skeleton className="h-9 w-28 mb-[-1px]" />
        <Skeleton className="h-9 w-28 mb-[-1px]" />
      </div>

      {/* Projects grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}
