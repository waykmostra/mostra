'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Copie le lien client d'une sous-phase (partage « phase-only »).
 * Le chemin est relatif ; l'origine est ajoutée côté navigateur.
 */
export default function CopySubPhaseLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      const url = `${window.location.origin}${path}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Lien de la sous-phase copié')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossible de copier')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copier le lien client de cette sous-phase (partage phase-only)"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-2 border border-line text-dim hover:text-ink hover:border-line-strong transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? 'Copié' : 'Lien client'}
    </button>
  )
}
