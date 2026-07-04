import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the Gradio client as a runtime dependency of the route handler
  // instead of bundling it — it pulls in Node built-ins and ESM that don't
  // bundle cleanly.
  serverExternalPackages: ["@gradio/client"],
};

export default nextConfig;
