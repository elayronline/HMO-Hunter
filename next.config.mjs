import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://*.sentry.io https://maps.googleapis.com https://maps.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.zoopla.co.uk https://lc.zoocdn.com https://lid.zoocdn.com https://st.zoocdn.com https://*.onthemarket.com https://media.rightmove.co.uk https://maps.googleapis.com https://img.youtube.com https://tiles.stadiamaps.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.mapbox.com https://*.tiles.mapbox.com https://maps.googleapis.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://tiles.basemaps.cartocdn.com https://*.cartocdn.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://api.postcodes.io https://nominatim.openstreetmap.org https://tiles.stadiamaps.com https://*.stadiamaps.com",
              "frame-src 'self' https://www.youtube.com https://youtube.com",
              "frame-ancestors 'self'",
              "form-action 'self'",
              "base-uri 'self'",
              "worker-src 'self' blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },

  images: {
    // Enable image optimization with allowed external domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/maps/api/streetview/**',
      },
      {
        protocol: 'https',
        hostname: '*.zoopla.co.uk',
      },
      {
        protocol: 'https',
        hostname: 'lc.zoocdn.com', // Zoopla CDN for images
      },
      {
        protocol: 'https',
        hostname: 'lid.zoocdn.com', // Zoopla CDN for listing images
      },
      {
        protocol: 'https',
        hostname: 'st.zoocdn.com', // Zoopla static CDN
      },
      {
        protocol: 'https',
        hostname: '*.onthemarket.com',
      },
      {
        protocol: 'https',
        hostname: '*.rightmove.co.uk',
      },
      {
        protocol: 'https',
        hostname: 'media.rightmove.co.uk',
      },
    ],
    // Optimize images to modern formats
    formats: ['image/webp', 'image/avif'],
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in production
  silent: !process.env.CI,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Hide source maps from browser devtools
  hideSourceMaps: true,

  // Tunneling to avoid ad blockers
  tunnelRoute: "/monitoring",

  // Automatically instrument React components
  reactComponentAnnotation: {
    enabled: true,
  },
})
