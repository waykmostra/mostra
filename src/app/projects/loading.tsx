import { Skeleton } from '@/components/shared/Skeleton'

export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 space-y-3"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
