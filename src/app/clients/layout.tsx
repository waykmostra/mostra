import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppSidebar from '@/components/dashboard/AppSidebar'
import AppTopbar from '@/components/dashboard/AppTopbar'
import { Toaster } from 'sonner'

export default async function ClientsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppSidebar />
      <AppTopbar />
      <main className="md:ml-[var(--rail-w)] min-h-screen pt-14">
        <div className="w-full px-4 sm:px-6 lg:px-10 py-8">{children}</div>
      </main>
      <Toaster
        theme="light"
        position="top-right"
        toastOptions={{
          style: { background: '#ffffff', border: '1px solid #d4d4d9', color: '#171718' },
        }}
      />
    </div>
  )
}
