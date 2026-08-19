import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
})

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
  weight: ["400", "500"],
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1e293b" },
  ],
}

export const metadata: Metadata = {
  title: "HMO Hunter | Find Viable HMOs. Spot Untapped Opportunities.",
  description: "The UK's first sourcing platform built exclusively for HMO professionals. Search compliance data, licensing status, Article 4 zones, and yield projections — all in one place.",
  icons: {
    icon: "/icon-light-32x32.png",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HMO Hunter",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${dmMono.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`font-sans antialiased safe-area-inset`}>
        {/* The worker caches /_next/static/** cache-first and never versions
            that cache. Production chunk names are content-hashed, so a new
            build asks for new URLs and this is safe. Development reuses chunk
            names across rebuilds, so the worker keeps answering with the
            previous build's JavaScript at the same URL — which surfaces as
            "module factory is not available" and as hydration mismatches
            between new server HTML and stale client code, neither of which is
            a fault in the code being edited. So: register in production only,
            and tear down any registration a developer already has. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              process.env.NODE_ENV === "production"
                ? `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `
                : `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations()
                  .then((rs) => rs.forEach((r) => r.unregister()))
                  .catch(() => {});
              }
              if (window.caches) {
                caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
              }
            `,
          }}
        />
        {children}
        <Toaster />
        <SonnerToaster position="bottom-right" />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
