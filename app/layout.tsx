import type { Metadata, Viewport } from 'next'
import { Orbitron, Rajdhani, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import '../styles/jarvis-core.css'
import '../styles/holo.css'

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-orbitron',
  display: 'swap',
})

const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-rajdhani',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'J.A.R.V.I.S.',
  description: 'Stark Industries HUD AI Assistant',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'J.A.R.V.I.S.',
  },
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/apple-touch-icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#02040A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${rajdhani.variable} ${inter.variable} ${jetbrainsMono.variable} dark`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.add('dark');
                  var scanlines = localStorage.getItem('jarvis-scanlines') !== 'false';
                  var holo = localStorage.getItem('jarvis-holo') !== 'false';
                  document.documentElement.setAttribute('data-scanlines', scanlines ? 'true' : 'false');
                  document.documentElement.setAttribute('data-holo', holo ? 'true' : 'false');
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="no-horizontal-overflow bg-[var(--bg)] text-[var(--text)] antialiased font-sans select-none">
        {children}
      </body>
    </html>
  )
}
