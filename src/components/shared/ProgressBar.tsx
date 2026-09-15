interface ProgressBarProps {
  value: number // 0–100
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export default function ProgressBar({
  value,
  className = '',
  showLabel = false,
  size = 'sm',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const height = size === 'sm' ? 'h-1' : 'h-1.5'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`flex-1 ${height} bg-surface-3 rounded-full overflow-hidden`}>
        <div
          className="h-full bg-brand rounded-full"
          style={{
            width: `${clamped}%`,
            transition: 'width var(--t-slow) var(--ease)',
          }}
        />
      </div>
      {showLabel && (
        <span className="mono-label tnum w-9 text-right text-faint">{clamped}%</span>
      )}
    </div>
  )
}
