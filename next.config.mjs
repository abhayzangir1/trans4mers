/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  experimental: {
    after: true,
  },
  serverExternalPackages: [
    'pg',
    '@google-cloud/pubsub',
    '@google-cloud/storage',
    'google-auth-library',
    'playwright-core'
  ]
};

export default nextConfig;
