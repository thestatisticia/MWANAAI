import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdf.js out of the Next bundler so its worker file resolves correctly.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
