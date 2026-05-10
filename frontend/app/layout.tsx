import type { Metadata } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: 'FX-AlphaLab | Trading Platform',
  description: 'Professional FX trading platform with AI-powered analysis, real-time charts, and intelligent trade recommendations',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/fx-mark.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/fx-mark.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/fx-mark.png',
        type: 'image/png',
      },
    ],
    apple: '/fx-mark.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${ibmPlexSans.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
