/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    domains: ['localhost', 's3.amazonaws.com', 'minio.local'],
    unoptimized: true,
  },
  // NOTE: Do NOT use the `env:` block for NEXT_PUBLIC_* vars — it bakes values
  // into the standalone bundle at build time and overrides Docker runtime env vars.
  // Instead, pass NEXT_PUBLIC_* as Docker build args: docker build --build-arg NEXT_PUBLIC_AUTH_SERVICE_URL=...
};

module.exports = nextConfig;
