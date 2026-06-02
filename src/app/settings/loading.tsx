import { Skeleton } from '@/components/shared/Skeleton'

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
