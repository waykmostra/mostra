'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Minus, Moon, Plus, Sun, Smartphone } from 'lucide-react'

const SIZES = [15, 17, 19, 22, 26, 30, 36]
const SIZE_KEY = 'mostra-share-size'

type WakeLock = { release: () => Promise<void>; addEventListener: (t: 'release', f: () => void) => void }

/**
 * Lecture d'un script partagé sur téléphone : taille du texte (A− / A+),
 * mode nuit (le même réglage que l'app) et « Écran allumé » (Wake Lock),
 * pour lire pendant un tournage sans que l'écran se mette en veille.
 */
export default function ShareReader({ children }: { children: ReactNode }) {
  const [size, setSize] = useState(2)
  const [dark, setDark] = useState(false)
  const [awake, setAwake] = useState(false)
  const [canWake, setCanWake] = useState(false)
  const lock = useRef<WakeLock | null>(null)

  useEffect(() => {
    try {
      const s = Number(localStorage.getItem(SIZE_KEY))
      if (s >= 0 && s < SIZES.length && localStorage.getItem(SIZE_KEY) !== null) setSize(s)
    } catch { /* stockage indisponible */ }
    setDark(document.documentElement.classList.contains('dark'))
    setCanWake('wakeLock' in navigator)
  }, [])

  const pickSize = (s: number) => {
    const next = Math.max(0, Math.min(SIZES.length - 1, s))
    setSize(next)
    try { localStorage.setItem(SIZE_KEY, String(next)) } catch { /* noop */ }
  }

  const toggleDark = () => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    setDark(next)
    try { localStorage.setItem('mostra-theme', next ? 'dark' : 'light') } catch { /* noop */ }
  }

  const requestLock = useCallback(async () => {
    try {
      const wl = await (navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<WakeLock> } }).wakeLock.request('screen')
      lock.current = wl
      wl.addEventListener('release', () => { if (lock.current === wl) lock.current = null })
      return true
    } catch {
      return false
    }
  }, [])

  const toggleAwake = async () => {
    if (awake) {
      setAwake(false)
      await lock.current?.release().catch(() => {})
      lock.current = null
    } else {
      setAwake(await requestLock())
    }
  }

  // Le verrou saute quand on quitte l'onglet : on le reprend au retour.
  useEffect(() => {
    if (!awake) return
    const onVis = () => { if (document.visibilityState === 'visible' && !lock.current) requestLock() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [awake, requestLock])

  const btn = 'h-10 min-w-10 px-2.5 grid place-items-center rounded-[var(--r-sm)] text-[rgb(var(--c-text-dim))] active:bg-[rgb(var(--c-border))] disabled:opacity-35'

  return (
    <>
      <div style={{ fontSize: SIZES[size] }}>{children}</div>
      <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center pb-[max(12px,env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-[var(--r-lg)] border border-[rgb(var(--c-border))] bg-[rgb(var(--c-surface)/0.94)] backdrop-blur px-1 py-1 shadow-lg">
          <button className={btn} onClick={() => pickSize(size - 1)} disabled={size === 0} aria-label="Texte plus petit"><Minus className="w-4 h-4" /></button>
          <span className="w-9 text-center text-[13px] font-medium text-[rgb(var(--c-text))]" aria-hidden>Aa</span>
          <button className={btn} onClick={() => pickSize(size + 1)} disabled={size === SIZES.length - 1} aria-label="Texte plus grand"><Plus className="w-4 h-4" /></button>
          <span className="w-px h-6 bg-[rgb(var(--c-border))] mx-1" />
          <button className={btn} onClick={toggleDark} aria-label={dark ? 'Mode jour' : 'Mode nuit'}>
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {canWake && (
            <button
              className={`${btn} gap-1.5 !flex items-center text-[13px] ${awake ? '!text-[var(--brand-text)]' : ''}`}
              onClick={toggleAwake}
              aria-pressed={awake}
              title="Empêche l’écran de se mettre en veille"
            >
              <Smartphone className="w-4 h-4" /> {awake ? 'Écran allumé' : 'Garder allumé'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
