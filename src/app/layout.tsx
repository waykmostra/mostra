import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono, Sora } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegistrar from '@/components/shared/ServiceWorkerRegistrar'

// Les deux familles du site Mostra, et rien d'autre : Sora pour les titres,
// Inter pour le texte. Le mono ne sert qu'aux micro-labels et aux compteurs.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'MOSTRA — Gestion de production créative',
  description: 'SaaS de gestion de production pour agences créatives',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mostra',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/icons/icon-180.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#020302',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Pas d'`antialiased` : on garde le rendu sous-pixel de Windows, sur lequel
  // Inter et Sora sont nettement plus nettes. Même choix que le site.
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        {/* Mode nuit sans flash : applique .dark avant le premier paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement;if(localStorage.getItem('mostra-theme')==='dark')d.classList.add('dark');if(localStorage.getItem('mostra-rail')==='collapsed')d.style.setProperty('--rail-w','68px')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
