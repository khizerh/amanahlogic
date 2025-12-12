const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'anrthvrwbuqonjwxhofo.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Turbopack config (Next.js 16 default)
  turbopack: {
    resolveAlias: {
      '@emails': path.resolve(__dirname, './emails'),
    },
  },
  // Keep webpack config for backwards compatibility
  webpack: (config) => {
    config.resolve.alias['@emails'] = path.resolve(__dirname, './emails');
    return config;
  },
};

module.exports = nextConfig;
