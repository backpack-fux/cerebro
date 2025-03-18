import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Explicitly disable Pages Router
  pageExtensions: ['tsx', 'ts'],
  // Use standalone output for better optimization
  output: 'standalone',
};

export default nextConfig;
