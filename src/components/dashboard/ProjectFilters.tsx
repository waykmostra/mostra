'use client'

import { Search } from 'lucide-react'
import type { ProjectStatus } from '@/lib/types'

export type FilterTab = 'all' | ProjectStatus

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'completed', label: 'Terminés' },
  { value: 'on_hold', label: 'En pause' },
]

interface ProjectFiltersProps {
  activeFilter: FilterTab
  search: string
  onFilterChange: (filter: FilterTab) => void
  onSearchChange: (value: string) => void
}

export default function ProjectFilters({
  activeFilter,
  search,
  onFilterChange,
  onSearchChange,
}: ProjectFiltersProps) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface border border-line rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onFilterChange(tab.value)}
            className={`
              px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors
              ${
                activeFilter === tab.value
                  ? 'bg-surface-2 text-ink'
                  : 'text-dim hover:text-ink'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-faint" />
        <input
          type="text"
          placeholder="Rechercher un projet…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="
            pl-9 pr-4 py-2 text-[13px] rounded-xl w-56
            bg-surface border border-line
            text-ink placeholder:text-faint
            outline-none focus:border-line-strong transition-colors
          "
        />
      </div>
    </div>
  )
}
