import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the generated Prisma client out of the Next bundle so JSON mode can
  // boot without `prisma generate`.
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Allow the hosted HTTPS preview (*.e2b.app) to talk to the Next.js dev server.
  allowedDevOrigins: ["*.e2b.app"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "/api/:path*"
      }
    ];
  }
};

export default nextConfig;
