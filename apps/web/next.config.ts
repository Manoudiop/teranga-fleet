import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // Le package partagé est compilé en CommonJS : il est consommé tel quel.
  poweredByHeader: false,
};

export default nextConfig;
