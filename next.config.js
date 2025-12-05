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
  
  // Environment variables embedded at build time
  // These are available in both client and server code
  // For Amplify Gen 2, set these in Amplify Console > Environment Variables
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    // Server-side env vars (embedded at build time for SSR)
    MESH_CLIENT_ID: process.env.MESH_CLIENT_ID,
    MESH_CLIENT_SECRET: process.env.MESH_CLIENT_SECRET,
    WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,
    MERCHANT_WALLET_ADDRESS: process.env.MERCHANT_WALLET_ADDRESS,
    MESH_API_URL: process.env.MESH_API_URL,
    AWS_REGION: process.env.AWS_REGION,
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
