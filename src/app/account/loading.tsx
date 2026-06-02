import { Skeleton } from '@/components/shared/Skeleton'

export default function AccountLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Skeleton className="h-7 w-32" />
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
