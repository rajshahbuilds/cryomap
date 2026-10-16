import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/auth/login",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
