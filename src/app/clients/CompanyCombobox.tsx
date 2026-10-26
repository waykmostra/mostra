'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Check, Plus, X } from 'lucide-react'

export interface CompanyChoice {
  /** null + nom rempli = société à créer à l'enregistrement. */
  id: string | null
  name: string
}

interface Props {
  companies: { id: string; name: string }[]
  value: CompanyChoice
  onChange: (value: CompanyChoice) => void
  disabled?: boolean
  inputClassName: string
}

/**
 * Champ « Société » : on tape, on choisit une société existante ou on crée
 * celle qu'on vient de taper. Rien n'est écrit en base avant l'envoi du
 * formulaire.
 */
export default function CompanyCombobox({ companies, value, onChange, disabled, inputClassName }: Props) {
  const [query, setQuery] = useState(value.name)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const clean = query.trim()
  const matches = useMemo(() => {
    const q = clean.toLowerCase()
    return q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies
  }, [companies, clean])
  const exact = companies.find((c) => c.name.toLowerCase() === clean.toLowerCase())

  function pick(choice: CompanyChoice) {
    setQuery(choice.name)
    onChange(choice)
    setOpen(false)
  }

  function type(next: string) {
    setQuery(next)
    setOpen(true)
    const match = companies.find((c) => c.name.toLowerCase() === next.trim().toLowerCase())
    onChange(match ? { id: match.id, name: match.name } : { id: null, name: next.trim() })
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          id="company"
          type="text"
          autoComplete="off"
          placeholder="Choisir ou créer une société"
          value={query}
          onChange={(e) => type(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter') {
              e.preventDefault()
              if (exact) pick({ id: exact.id, name: exact.name })
              else if (clean) pick({ id: null, name: clean })
            }
          }}
          className={`${inputClassName} pr-9`}
          disabled={disabled}
        />
        {query && !disabled && (
          <button
            type="button"
            onClick={() => pick({ id: null, name: '' })}
            aria-label="Retirer la société"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-faint hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {value.name && (
        <p className="mt-1.5 text-xs text-faint">
          {value.id ? 'Société existante' : 'Nouvelle société, créée avec le contact'}
        </p>
      )}

      {open && !disabled && (matches.length > 0 || (clean && !exact)) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-2xl shadow-black/20">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick({ id: c.id, name: c.name })}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-faint" />
              <span className="flex-1 truncate text-sm text-ink">{c.name}</span>
              {c.id === value.id && <Check className="h-3.5 w-3.5 flex-shrink-0 text-brand" />}
            </button>
          ))}
          {clean && !exact && (
            <button
              type="button"
              onClick={() => pick({ id: null, name: clean })}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-brand transition-colors hover:bg-surface-2"
            >
              <Plus className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate text-sm">Créer « {clean} »</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
