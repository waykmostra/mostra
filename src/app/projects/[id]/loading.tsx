import { Skeleton } from '@/components/shared/Skeleton'

export default function ProjectLoading() {
  return (
    <div className="min-h-screen bg-canvas px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back + Header */}
        <div>
          <Skeleton className="h-3.5 w-20 mb-4" />
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <Skeleton className="h-6 w-2/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
            <Skeleton className="h-5 w-20 flex-shrink-0 mt-0.5" />
          </div>
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          {/* Left: phases */}
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-surface border border-line rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20 flex-shrink-0" />
                </div>
                <Skeleton className="h-1 w-full rounded-full" />
                <div className="flex items-center gap-2">
                  {[0, 1].map((j) => (
                    <Skeleton key={j} className="h-7 w-24 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right: sidebar */}
          <div className="space-y-4">
            {/* Info card */}
            <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
              <Skeleton className="h-3 w-20" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
            {/* Comments */}
            <div className="bg-surface border border-line rounded-xl p-5 space-y-3">
              <Skeleton className="h-3 w-24" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-2.5">
                  <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
