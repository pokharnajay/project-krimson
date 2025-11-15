/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
      domains: ['img.youtube.com', 'i.ytimg.com'],
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '**.youtube.com',
        },
        {
          protocol: 'https',
          hostname: '**.ytimg.com',
        },
      ],
    },
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_TOKEN_EXPIRY: process.env.NEXT_PUBLIC_TOKEN_EXPIRY,
    },
  }
  
  module.exports = nextConfig
  