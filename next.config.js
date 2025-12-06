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
  
  // Optimize images for production
  images: {
    unoptimized: true, // Required for standalone output
  },
  
  // TypeScript strict mode
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint config moved to eslint.config.js in Next.js 16
  // See: https://nextjs.org/docs/app/api-reference/cli/next#next-lint-options
};

module.exports = nextConfig;
