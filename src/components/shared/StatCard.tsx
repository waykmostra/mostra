import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  value: number | string
}

/**
 * Une cellule de chiffre. Elle ne porte pas son propre cadre : plusieurs
 * cellules se posent côte à côte dans une seule feuille (voir StatRow), pour
 * lire comme un objet unique et non comme trois cartes identiques.
 *
 * La hiérarchie tient au seul contraste d'échelle — chiffre énorme contre
 * micro-label mono. Pas de pastille colorée : le vert reste réservé à ce qui
 * appelle une action.
 */
export function StatCard({ icon: Icon, label, value }: Props) {
  const displayValue = typeof value === 'number' ? value.toLocaleString('fr-FR') : value

  return (
    <div className="flex-1 px-5 py-4">
      <div className="mono-label flex items-center gap-1.5 text-faint">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        {label}
      </div>
      <p className="font-display tnum mt-2.5 text-[2rem] leading-none text-ink">{displayValue}</p>
    </div>
  )
}

/** Regroupe des StatCard en une seule feuille, séparées par un filet. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface flex flex-col divide-y divide-line sm:flex-row sm:divide-x sm:divide-y-0">
      {children}
    </div>
  )
}
