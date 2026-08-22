/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    proxyClientMaxBodySize: '2gb',
    serverActions: {
      bodySizeLimit: '2gb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/storage/:path*',
        destination: `${backendUrl}/storage/:path*`,
      },
      {
        source: '/docs',
        destination: `${backendUrl}/docs`,
      },
      {
        source: '/scalar',
        destination: `${backendUrl}/scalar`,
      },
      {
        source: '/openapi.yaml',
        destination: `${backendUrl}/openapi.yaml`,
      }
    ];
  },
};

module.exports = nextConfig;
