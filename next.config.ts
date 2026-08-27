import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both parsers ship prebuilt bundles with dynamic requires that the bundler
  // cannot follow; loading them from node_modules at runtime avoids that.
  serverExternalPackages: ["unpdf", "mammoth"],

  experimental: {
    serverActions: {
      // Transcripts are long and PDFs are heavier still — the 1MB default
      // rejects a couple of hours of dialogue. The limit applies to the raw
      // multipart body, so this leaves room for part headers too.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
