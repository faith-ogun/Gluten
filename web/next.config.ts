import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Next to emit a standalone bundle so Firebase App Hosting
  // has a self-contained server to run. The postbuild script in
  // package.json then copies public/ into .next/standalone/public/
  // because Next's tracing doesn't auto-include files referenced by
  // <img src=...> at request time.
  output: "standalone",
};

export default nextConfig;
