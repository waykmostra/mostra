'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export default function CopyLinkButton({
  url,
  label,
  mono = false,
}: {
  url: string
  label?: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]
        border border-line text-faint hover:text-ink hover:border-line-strong
        transition-colors ${mono ? 'font-mono tracking-wider' : ''}`}
      title={label ? `Copier ${label}` : 'Copier le lien'}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-[#22C55E] flex-shrink-0" />
          <span className="text-[#22C55E]">Copié !</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 flex-shrink-0" />
          {label ?? 'Copier le lien'}
        </>
      )}
    </button>
  )
}
