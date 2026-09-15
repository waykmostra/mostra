import type { CSSProperties } from 'react'

interface Props {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className = '', style }: Props) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} style={style} />
}
