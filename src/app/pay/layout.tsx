import type { Metadata } from 'next'
import { Toaster } from 'sonner'

// Les liens de paiement ne doivent jamais être indexés.
export const metadata: Metadata = {
  title: 'Paiement — MOSTRA',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

/** Page publique d'un lien de paiement : sobre, sans navigation du portail. */
export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      {children}
      <Toaster
        theme="light"
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgb(var(--c-surface))',
            border: '1px solid rgb(var(--c-border))',
            color: 'rgb(var(--c-text))',
          },
        }}
      />
    </div>
  )
}
