import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Avatars + attachment uploads via server actions (default is 1MB).
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
