import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.2.3"],

  async rewrites() {
    return [
      {
        source: "/api/compress-pdf",
        destination: "http://127.0.0.1:8000/compress-pdf",
      },
    ];
  },
};

export default nextConfig;
