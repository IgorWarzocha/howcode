import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    include: /\.[cm]?[jt]sx?$/,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "desktop/**/*.test.ts"],
  },
});
