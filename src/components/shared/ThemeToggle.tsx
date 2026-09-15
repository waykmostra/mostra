'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

/**
 * Bascule jour / nuit. Le thème « clair » est le défaut (pas de classe) ;
 * le mode nuit ajoute `.dark` sur <html> et est persisté dans localStorage.
 * Un script inline dans le <head> (layout.tsx) applique le thème avant le
 * premier paint pour éviter tout flash.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    setMounted(true)
  }, [])

  function toggle() {
    const root = document.documentElement
    const next = !root.classList.contains('dark')
    if (next) {
      root.classList.add('dark')
      try { localStorage.setItem('mostra-theme', 'dark') } catch {}
    } else {
      root.classList.remove('dark')
      try { localStorage.setItem('mostra-theme', 'light') } catch {}
    }
    setDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Passer en mode jour' : 'Passer en mode nuit'}
      title={dark ? 'Mode jour' : 'Mode nuit'}
      className="inline-flex items-center justify-center h-9 w-9 rounded-sm text-chrome-faint hover:text-chrome-text hover:bg-white/[0.06] transition-colors duration-[160ms]"
    >
      {/* Avant montage : on rend l'icône lune par défaut (clair) pour éviter le mismatch SSR. */}
      {mounted && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
