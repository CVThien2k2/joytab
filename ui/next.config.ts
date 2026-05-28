import type { NextConfig } from "next";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  reactCompiler: true,
  /**
   * Input: Request từ browser tới Next dev/prod server.
   * Output: Mọi đường dẫn `/auth/*` được proxy sang BE Nest để cookie thuộc FE origin.
   */
  async rewrites() {
    return [
      {
        source: "/auth/:path*",
        destination: `${BACKEND_URL}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
