import { defineConfig } from "vitest/config";
import path from "node:path";

const srcDir = path.resolve(import.meta.dirname, "./src");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": srcDir,
    },
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
  },
});