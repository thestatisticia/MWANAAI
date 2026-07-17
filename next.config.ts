import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep document parsers out of the Next bundler for reliable serverless loads.
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
