'use client'

import { useState, useRef, useEffect } from 'react'
import {
  FileText,
  Palette,
  Film,
  MonitorPlay,
  Camera,
  Layers,
  Sparkles,
  Zap,
  Code,
  Video,
  Music,
  Image,
  PenTool,
  Scissors,
  Package,
  Star,
  Globe,
  Mic,
  Headphones,
  Clapperboard,
} from 'lucide-react'

// ── Catalogue d'icônes disponibles ──────────────────────────────

export const ICON_CATALOG = [
  { name: 'FileText', label: 'Script', Component: FileText },
  { name: 'Palette', label: 'Design', Component: Palette },
  { name: 'Film', label: 'Film', Component: Film },
  { name: 'MonitorPlay', label: 'Render', Component: MonitorPlay },
  { name: 'Clapperboard', label: 'Clap', Component: Clapperboard },
  { name: 'Camera', label: 'Caméra', Component: Camera },
  { name: 'Video', label: 'Vidéo', Component: Video },
  { name: 'Layers', label: 'Layers', Component: Layers },
  { name: 'Sparkles', label: 'Effets', Component: Sparkles },
  { name: 'Zap', label: 'Énergie', Component: Zap },
  { name: 'Code', label: 'Code', Component: Code },
  { name: 'Music', label: 'Son', Component: Music },
  { name: 'Mic', label: 'Micro', Component: Mic },
  { name: 'Headphones', label: 'Audio', Component: Headphones },
  { name: 'Image', label: 'Image', Component: Image },
  { name: 'PenTool', label: 'Stylo', Component: PenTool },
  { name: 'Scissors', label: 'Montage', Component: Scissors },
  { name: 'Package', label: 'Livrable', Component: Package },
  { name: 'Star', label: 'Étoile', Component: Star },
  { name: 'Globe', label: 'Global', Component: Globe },
] as const

export type IconName = (typeof ICON_CATALOG)[number]['name']

// ── Helper : rendre une icône à partir de son nom ────────────────

export function PhaseIcon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const found = ICON_CATALOG.find((i) => i.name === name)
  if (!found) return <FileText className={className} />
  const { Component } = found
  return <Component className={className} />
}

// ── Composant IconPicker ─────────────────────────────────────────

interface Props {
  value: string
  onChange: (name: string) => void
  disabled?: boolean
}

export default function IconPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`
          w-9 h-9 rounded-lg border flex items-center justify-center transition-colors
          ${
            open
              ? 'border-brand/40 bg-brand/10 text-brand'
              : 'border-line bg-surface text-faint hover:border-line-strong hover:text-ink'
          }
          disabled:opacity-40 disabled:cursor-not-allowed
        `}
        title="Changer l'icône"
      >
        <PhaseIcon name={value} className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-30
          bg-surface border border-line rounded-xl shadow-2xl p-2
          grid grid-cols-5 gap-1 w-[196px]"
        >
          {ICON_CATALOG.map(({ name, label, Component }) => (
            <button
              key={name}
              type="button"
              title={label}
              onClick={() => {
                onChange(name)
                setOpen(false)
              }}
              className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                ${
                  value === name
                    ? 'bg-brand/20 text-brand border border-brand/30'
                    : 'text-faint hover:text-ink hover:bg-surface-2 border border-transparent'
                }
              `}
            >
              <Component className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
