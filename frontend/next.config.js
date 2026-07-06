/** @type {import('next').NextConfig} */
// The frontend calls a relative `/api`, which Next proxies to the backend.
// In production set BACKEND_URL to the backend's (internal) URL; defaults to
// localhost:3001 for local dev.
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
