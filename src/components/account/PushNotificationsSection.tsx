'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bell, BellOff, Loader2, Share } from 'lucide-react'
import {
  isPushSupported,
  isSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
  currentPermission,
} from '@/lib/push/client'

type Status = 'loading' | 'unsupported' | 'ios-needs-install' | 'off' | 'on' | 'denied'

/** iOS/iPadOS : le push n'est dispo qu'en PWA installée (écran d'accueil). */
function isIosSafariNotInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  // @ts-expect-error — standalone est une propriété non standard de Safari iOS
  const standalone = window.navigator.standalone === true
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches
  return isIos && !standalone && !displayStandalone
}

export default function PushNotificationsSection() {
  const [status, setStatus] = useState<Status>('loading')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let active = true
    async function init() {
      if (!isPushSupported()) {
        if (active) setStatus(isIosSafariNotInstalled() ? 'ios-needs-install' : 'unsupported')
        return
      }
      if (isIosSafariNotInstalled()) {
        if (active) setStatus('ios-needs-install')
        return
      }
      const perm = currentPermission()
      if (perm === 'denied') {
        if (active) setStatus('denied')
        return
      }
      const subbed = await isSubscribed()
      if (active) setStatus(subbed ? 'on' : 'off')
    }
    init()
    return () => {
      active = false
    }
  }, [])

  async function handleEnable() {
    setPending(true)
    const result = await subscribeToPush()
    setPending(false)
    if (result.ok) {
      setStatus('on')
      toast.success('Notifications activées sur cet appareil')
    } else if (result.reason === 'denied') {
      setStatus('denied')
      toast.error('Permission refusée — autorisez les notifications dans votre navigateur')
    } else if (result.reason === 'unsupported') {
      setStatus('unsupported')
      toast.error('Notifications non supportées sur cet appareil')
    } else {
      toast.error(`Échec de l'activation${result.detail ? ` : ${result.detail}` : ''}`)
    }
  }

  async function handleDisable() {
    setPending(true)
    await unsubscribeFromPush()
    setPending(false)
    setStatus('off')
    toast.success('Notifications désactivées sur cet appareil')
  }

  return (
    <section className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Notifications push</h2>
        <p className="text-xs text-[#555555] mt-0.5">
          Recevez les alertes directement sur cet appareil, même l&apos;application fermée
        </p>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-[#555555]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Vérification…
        </div>
      )}

      {status === 'unsupported' && (
        <p className="text-xs text-[#888888] bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
          Votre navigateur ne supporte pas les notifications push.
        </p>
      )}

      {status === 'ios-needs-install' && (
        <div className="text-xs text-[#a0a0a0] bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
          <p className="text-white font-medium">Sur iPhone / iPad, une étape est nécessaire :</p>
          <ol className="list-decimal list-inside space-y-1 text-[#888888]">
            <li className="flex items-center gap-1.5">
              Appuyez sur <Share className="h-3.5 w-3.5 inline text-[#00D76B]" /> Partager
            </li>
            <li>Choisissez « Sur l&apos;écran d&apos;accueil »</li>
            <li>Ouvrez Mostra depuis l&apos;icône, puis revenez ici</li>
          </ol>
        </div>
      )}

      {status === 'denied' && (
        <p className="text-xs text-[#888888] bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3">
          Les notifications sont bloquées. Autorisez-les dans les réglages de votre navigateur pour
          ce site, puis rechargez la page.
        </p>
      )}

      {status === 'off' && (
        <button
          type="button"
          onClick={handleEnable}
          disabled={pending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D76B] text-black text-sm font-semibold hover:bg-[#00c060] disabled:opacity-50 transition-colors"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          Activer les notifications
        </button>
      )}

      {status === 'on' && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs text-[#00D76B] font-medium">
            <Bell className="h-3.5 w-3.5" />
            Activées sur cet appareil
          </span>
          <button
            type="button"
            onClick={handleDisable}
            disabled={pending}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#888888] text-xs hover:text-white hover:border-[#3a3a3a] disabled:opacity-50 transition-colors"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BellOff className="h-3 w-3" />}
            Désactiver
          </button>
        </div>
      )}
    </section>
  )
}
