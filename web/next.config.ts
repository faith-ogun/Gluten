import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase App Hosting expects Next.js standalone output. Without
  // this, Next 16 with Turbopack emits the default bundle and the
  // /public folder is dropped from the deployed image, so every asset
  // under /logo, /marsh-demo, etc. 404s in production while working
  // fine in `next dev`. Standalone mode copies public/ into the
  // bundle, which App Hosting then serves.
  output: "standalone",
};

export default nextConfig;
