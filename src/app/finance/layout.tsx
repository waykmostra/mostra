import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import AdminHeader from '@/components/dashboard/AdminHeader'
import { Toaster } from 'sonner'

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <AdminHeader />

      {/* Main content — offset par la sidebar + header fixe */}
      <main className="md:ml-[180px] min-h-screen pt-14">
        <div className="px-4 md:px-8 py-8">{children}</div>
      </main>

      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: '#111111',
            border: '1px solid #2a2a2a',
            color: '#ffffff',
          },
        }}
      />
    </div>
  )
}
