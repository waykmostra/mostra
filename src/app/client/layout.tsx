import { Toaster } from 'sonner'

/** Enveloppe du portail client. La barre supérieure et le rail projet sont
 *  montés par les segments : le dashboard n'a pas de rail, un projet oui. */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      {children}

      <Toaster
        theme="light"
        position="top-right"
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
