import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL === "1" ? undefined : "standalone",
  serverExternalPackages: ["sharp", "@node-projects/acad-ts"],
};

export default nextConfig;