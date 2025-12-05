/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for Lambda deployment
  output: 'standalone',
  
  // Enable server actions
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // Environment variables to expose to the client
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  
  // Optimize images for production
  images: {
    unoptimized: true, // Required for standalone output
  },
  
  // TypeScript strict mode
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint during builds
  eslint: {
    ignoreDuringBuilds: false,
  },
};

module.exports = nextConfig;
