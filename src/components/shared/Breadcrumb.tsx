import Link from 'next/link'

export interface Crumb {
  label: string
  href?: string
}

/** Chemin d'accès, lu comme un explorateur de fichiers. Le dernier segment
 *  est la page courante et n'est pas un lien. */
export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d'ariane">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px]">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-x-1.5">
              {i > 0 && (
                <span aria-hidden="true" className="select-none text-line-strong">
                  /
                </span>
              )}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="text-faint transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={last ? 'font-medium text-ink' : 'text-faint'}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
