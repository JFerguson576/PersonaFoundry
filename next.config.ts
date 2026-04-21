import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Vercel default output (.next), but use a custom local folder on Windows/OneDrive
  // to avoid locked-file issues during local builds.
  distDir: process.env.VERCEL ? ".next" : process.env.NEXT_DIST_DIR || ".next-build",
};

export default nextConfig;
