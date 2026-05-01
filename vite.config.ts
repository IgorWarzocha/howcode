import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function stripGhosttyPackageSourcemaps(): Plugin {
  return {
    name: "strip-ghostty-package-sourcemaps",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("/node_modules/@wterm/ghostty/dist/") || !id.endsWith(".js")) {
        return null;
      }

      return {
        code: code.replace(/\n?\/\/# sourceMappingURL=.*\.js\.map\s*$/u, ""),
        map: null,
      };
    },
  };
}

export default defineConfig({
  base: "./",
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["@wterm/ghostty"],
  },
  plugins: [stripGhosttyPackageSourcemaps(), react(), tailwindcss()],
  worker: {
    format: "es",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
  },
});
