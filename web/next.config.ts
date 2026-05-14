import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase App Hosting builds Next.js in standalone mode internally.
  // Next's output-file-tracing only includes files it sees referenced
  // by your code, so /public assets that are loaded as <img src=...>
  // at runtime (logo, brand assets) get DROPPED from the deploy
  // because no server-side code reads them. The marsh-demo manifest
  // survived only because /api/medgemma/marsh does fs.readFile on it.
  //
  // Force-include everything under /public so static assets ship.
  outputFileTracingIncludes: {
    "/*": ["./public/**/*"],
  },
};

export default nextConfig;
