'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string
  /** Nombre de lignes minimum (hauteur de départ). */
  minRows?: number
  /** Place le curseur en fin de texte au montage si autoFocus est actif. */
  focusEnd?: boolean
}

/**
 * Textarea dont la hauteur s'adapte au contenu (grandit/réduit avec le texte,
 * sans scroll interne ni redimensionnement manuel).
 */
export default function AutoGrowTextarea({
  value,
  minRows = 1,
  focusEnd = false,
  className,
  autoFocus,
  style,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Recalcule la hauteur à chaque changement de valeur.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  // Focus + curseur en fin au montage (édition).
  useEffect(() => {
    const el = ref.current
    if (el && autoFocus) {
      el.focus()
      if (focusEnd) {
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      className={className}
      style={{ overflow: 'hidden', resize: 'none', ...style }}
      {...rest}
    />
  )
}
