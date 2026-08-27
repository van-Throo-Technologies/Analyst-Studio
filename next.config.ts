import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These ship prebuilt bundles with dynamic requires the bundler cannot
  // follow — pdfkit also reads its standard-font metrics from disk. Loading
  // them from node_modules at runtime avoids both problems.
  serverExternalPackages: ["unpdf", "mammoth", "pdfkit"],

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
