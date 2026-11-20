import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/**": ["./data/frontdesk.sqlite"],
  },
};

export default nextConfig;
