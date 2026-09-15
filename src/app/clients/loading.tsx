import { Skeleton } from '@/components/shared/Skeleton'

export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-surface border border-line rounded-xl p-5 flex items-center gap-4"
          >
            <Skeleton className="w-9 h-9 flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="px-5 py-2.5 border-b border-line flex gap-4">
          {[1, 3, 1.5, 1].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ flex: w }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-[rgb(var(--c-surface))]">
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 flex-shrink-0" />
            <Skeleton className="h-3.5 w-20 flex-shrink-0" />
            <Skeleton className="h-7 w-14 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
