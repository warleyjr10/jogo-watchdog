import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Plantão do SMB | Congresso COONTROL',
  description: 'Jogo do Watchdog do SMB.',
  manifest: '/manifest.json',
}
export const viewport: Viewport = { themeColor: '#E84E0F', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400..800&family=Inter:wght@400;500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  )
}
