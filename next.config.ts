import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate": ["./data/**/*"],
    "/api/ratings": ["./data/seed-ratings.jsonl"],
  },
};

export default nextConfig;
