import { Skeleton } from '@/components/shared/Skeleton'

export default function NotificationsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4 flex items-start gap-3"
          >
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
