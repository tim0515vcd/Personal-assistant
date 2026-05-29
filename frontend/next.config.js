/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.INTERNAL_API_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
