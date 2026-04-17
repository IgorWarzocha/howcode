import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "howcode",
    identifier: "howcode.desktop.local",
    version: "0.1.1",
    description: "Desktop shell for Pi focused on fast local coding workflows.",
  },
  build: {
    artifactFolder: "artifacts",
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "build/desktop": "build/desktop",
      "desktop/resources": "resources",
      "node_modules/@mariozechner/pi-coding-agent/package.json": "resources/pi-coding-agent/package.json",
      "node_modules/@mariozechner/pi-coding-agent/README.md": "resources/pi-coding-agent/README.md",
      "node_modules/@mariozechner/pi-coding-agent/CHANGELOG.md": "resources/pi-coding-agent/CHANGELOG.md",
      "node_modules/@mariozechner/pi-coding-agent/docs": "resources/pi-coding-agent/docs",
      "node_modules/@mariozechner/pi-coding-agent/examples": "resources/pi-coding-agent/examples",
      "node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/theme": "resources/pi-coding-agent/dist/modes/interactive/theme",
      "node_modules/@mariozechner/pi-coding-agent/dist/core/export-html": "resources/pi-coding-agent/dist/core/export-html",
    },
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
  release: {
    baseUrl: "https://github.com/IgorWarzocha/howcode/releases/latest/download",
  },
} satisfies ElectrobunConfig;
