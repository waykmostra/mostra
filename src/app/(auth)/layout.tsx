import type { Metadata } from 'next'
import Logo from '@/components/shared/Logo'

export const metadata: Metadata = {
  title: 'MOSTRA — Connexion',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain relative min-h-screen overflow-hidden bg-chrome flex items-center justify-center px-5 py-12">
      {/* Grille verte 50px — le sol du hero du site. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,217,107,0.09) 0 1px, transparent 1px 100%), linear-gradient(90deg, rgba(0,217,107,0.09) 0 1px, transparent 1px 100%)',
          backgroundSize: '3.125rem 3.125rem',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 45%, #000 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 45%, #000 30%, transparent 75%)',
        }}
      />
      {/* Deux halos verts, décalés — la seule couleur de la scène. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-[15%] h-[420px] w-[420px] rounded-full bg-brand/[0.115] blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-[10%] h-[380px] w-[380px] rounded-full bg-brand/[0.09] blur-[130px]"
      />

      <div className="relative w-full max-w-[400px]">
        <div className="flex justify-center mb-10">
          <Logo variant="full" color="white" className="h-8" />
        </div>

        <div className="rounded-xl bg-surface p-7 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.85)]">
          {children}
        </div>
      </div>
    </div>
  )
}
