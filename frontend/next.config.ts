import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
    // Keep client bundles small for metered mobile data.
    optimizePackageImports: [],
  },
};

export default nextConfig;
