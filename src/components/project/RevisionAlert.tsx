'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface RevisionAlertProps {
  message: string
}

export default function RevisionAlert({ message }: RevisionAlertProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/8 p-4">
      <AlertTriangle className="h-4 w-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#F59E0B]">
          Le client a demandé des modifications
        </p>
        {message && (
          <p className="mt-1 text-xs text-dim leading-relaxed whitespace-pre-wrap break-words">
            {message}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Masquer l'alerte"
        className="flex-shrink-0 self-start p-1 rounded-md text-faint hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
