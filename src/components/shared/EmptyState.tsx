import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <Icon className="h-8 w-8 text-line-strong" strokeWidth={1.5} />
      <p className="mt-4 text-[15px] font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-[38ch] text-[13px] leading-relaxed text-faint">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
