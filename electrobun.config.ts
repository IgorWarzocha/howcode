import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "howcode",
    identifier: "howcode.desktop.local",
    version: "0.1.0",
    description: "Desktop shell for Pi focused on fast local coding workflows.",
  },
  build: {
    artifactFolder: "artifacts",
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "build/desktop": "build/desktop",
      "desktop/resources": "resources",
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
