/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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

export default nextConfig
