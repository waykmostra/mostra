import Link from 'next/link'
import { FolderX } from 'lucide-react'

export default function ProjectNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
      <div className="w-12 h-12 rounded-xl bg-surface border border-line flex items-center justify-center">
        <FolderX className="h-5 w-5 text-faint" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-base font-semibold text-ink">Projet introuvable</h2>
        <p className="text-sm text-faint max-w-xs">
          Ce projet n&apos;existe pas ou vous n&apos;avez pas accès à ce contenu.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          bg-surface border border-line text-dim hover:text-ink hover:border-line-strong
          transition-colors"
      >
        Retour au dashboard
      </Link>
    </div>
  )
}
