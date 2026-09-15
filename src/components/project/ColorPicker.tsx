'use client'

import { useState, useRef, useEffect } from 'react'

const PALETTE = [
  { label: 'Orange', value: '#F97316' },
  { label: 'Bleu', value: '#3B82F6' },
  { label: 'Vert MOSTRA', value: 'rgb(var(--c-brand))' },
  { label: 'Violet', value: '#A855F7' },
  { label: 'Rouge', value: '#EF4444' },
  { label: 'Jaune', value: '#EAB308' },
  { label: 'Rose', value: '#EC4899' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Gris', value: '#6B7280' },
]

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleCustomSubmit() {
    const hex = custom.startsWith('#') ? custom : `#${custom}`
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex)
      setOpen(false)
      setCustom('')
    }
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full border-2 border-white/20 shadow-sm flex-shrink-0 transition-transform hover:scale-110 focus:outline-none"
        style={{ backgroundColor: value }}
        title="Changer la couleur"
      />

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-7 z-50 w-48 bg-surface-2 border border-line rounded-xl p-3 shadow-2xl space-y-3">
          {/* Palette */}
          <div className="grid grid-cols-5 gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => { onChange(c.value); setOpen(false) }}
                className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none"
                style={{
                  backgroundColor: c.value,
                  borderColor: value === c.value ? 'white' : 'transparent',
                }}
                title={c.label}
              />
            ))}
          </div>

          {/* Custom hex */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-faint flex-shrink-0">#</span>
            <input
              type="text"
              maxLength={6}
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^0-9A-Fa-f]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSubmit() }}
              placeholder="F97316"
              className="flex-1 bg-surface border border-line rounded px-1.5 py-1 text-[11px] text-ink placeholder-[rgb(var(--c-border-strong))] font-mono focus:outline-none focus:border-[rgb(var(--c-text-faint))] w-0"
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              className="text-[10px] text-brand hover:text-ink transition-colors flex-shrink-0"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
