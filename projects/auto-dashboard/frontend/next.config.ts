import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js dev indicator (the little "N" badge in the bottom-left
  // during `next dev`). Production builds never show it; this just keeps the
  // local dev canvas clean so our own brand mark is the only logo visible.
  devIndicators: false,
};

export default nextConfig;
