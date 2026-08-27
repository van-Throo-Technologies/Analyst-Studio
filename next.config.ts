import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Transcripts are plain text but meeting recordings transcribe long — the
      // 1MB default rejects a couple of hours of dialogue. The limit applies to
      // the raw multipart body, so this leaves room for part headers too.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
