import { redirect } from 'next/navigation'
import { Toaster } from 'sonner'
import AppSidebar from '@/components/dashboard/AppSidebar'
import AppTopbar from '@/components/dashboard/AppTopbar'
import Link from 'next/link'
import Logo from '@/components/shared/Logo'
import { getCurrentProfile } from '@/lib/auth'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const toaster = (
    <Toaster
      theme="light"
      position="top-right"
      toastOptions={{
        style: { background: '#ffffff', border: '1px solid #d4d4d9', color: '#171718' },
      }}
    />
  )

  if (profile.is_admin) {
    return (
      <div className="min-h-screen bg-canvas text-ink">
        <AppSidebar />
        <AppTopbar />
        <main className="md:ml-[var(--rail-w)] min-h-screen pt-14">
          <div className="w-full px-4 sm:px-6 lg:px-10 py-8">{children}</div>
        </main>
        {toaster}
      </div>
    )
  }

  // Client — header minimal (mirror du client layout)
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-canvas/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[960px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/client/dashboard" className="flex items-center gap-2.5 select-none">
            <Logo variant="full" className="h-6" />
          </Link>
          <Link
            href="/client/dashboard"
            className="text-xs text-faint hover:text-ink transition-colors px-3 py-1.5 rounded-lg border border-line hover:border-line-strong"
          >
            ← Mes projets
          </Link>
        </div>
      </header>
      <main className="max-w-[960px] mx-auto px-6 py-8">{children}</main>
      {toaster}
    </div>
  )
}
