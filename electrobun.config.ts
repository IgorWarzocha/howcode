import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "howcode",
    identifier: "howcode.desktop.local",
    version: "0.1.0",
  },
  build: {
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
} satisfies ElectrobunConfig;
