import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use a custom build folder because OneDrive frequently locks `.next/*` files on Windows.
  distDir: ".next-build",
};

export default nextConfig;
