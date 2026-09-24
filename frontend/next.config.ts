import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@node-projects/acad-ts"],
};

export default nextConfig;