import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["sharp", "@node-projects/acad-ts"],
};

export default nextConfig;