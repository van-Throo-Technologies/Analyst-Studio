import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs and mammoth are Node-only and load their own assets at runtime.
  // Bundling them breaks those lookups, so they stay external on the server.
  serverExternalPackages: ["pdfjs-dist", "mammoth"],

  experimental: {
    serverActions: {
      // Server actions default to a 1 MB body. Intake accepts PDFs up to 10 MB,
      // so without this a large upload is rejected by the framework before the
      // parser ever runs — and the error it produces does not explain why.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
