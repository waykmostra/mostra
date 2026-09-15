import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-6 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-surface border border-line flex items-center justify-center">
        <FileQuestion className="h-6 w-6 text-faint" />
      </div>
      <div className="space-y-2">
        <p className="text-5xl font-bold text-[rgb(var(--c-surface-2))] tabular-nums">404</p>
        <h1 className="text-lg font-semibold text-ink">Page introuvable</h1>
        <p className="text-sm text-faint max-w-xs">
          Cette page n&apos;existe pas ou a été déplacée.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          bg-surface border border-line text-dim hover:text-ink hover:border-line-strong
          transition-colors"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  )
}
