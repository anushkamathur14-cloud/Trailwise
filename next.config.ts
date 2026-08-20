import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Include the seeded SQLite file in serverless function bundles (Vercel).
  outputFileTracingIncludes: {
    "/api/**/*": ["./prisma/demo.db"],
    "/*": ["./prisma/demo.db"],
  },
};

export default nextConfig;
