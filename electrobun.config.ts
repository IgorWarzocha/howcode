import type { ElectrobunConfig } from "electrobun";

function getSherpaOnnxPlatformPackage() {
  switch (`${process.platform}-${process.arch}`) {
    case "darwin-arm64":
      return "sherpa-onnx-darwin-arm64";
    case "darwin-x64":
      return "sherpa-onnx-darwin-x64";
    case "linux-arm64":
      return "sherpa-onnx-linux-arm64";
    case "linux-x64":
      return "sherpa-onnx-linux-x64";
    case "win32-ia32":
      return "sherpa-onnx-win-ia32";
    case "win32-x64":
      return "sherpa-onnx-win-x64";
    default:
      return null;
  }
}

const sherpaOnnxPlatformPackage = getSherpaOnnxPlatformPackage();
const sherpaOnnxCopyEntries: Record<string, string> = {};

if (sherpaOnnxPlatformPackage) {
  sherpaOnnxCopyEntries["node_modules/sherpa-onnx-node"] = "node_modules/sherpa-onnx-node";
  sherpaOnnxCopyEntries[`node_modules/${sherpaOnnxPlatformPackage}`] =
    `node_modules/${sherpaOnnxPlatformPackage}`;
}

export default {
  app: {
    name: "howcode",
    identifier: "howcode.desktop.local",
    version: "0.1.2",
    description: "Desktop shell for Pi focused on fast local coding workflows.",
  },
  build: {
    artifactFolder: "artifacts",
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "build/desktop": "build/desktop",
      "desktop/resources": "resources",
      "node_modules/@mariozechner/pi-coding-agent/package.json":
        "resources/pi-coding-agent/package.json",
      "node_modules/@mariozechner/pi-coding-agent/README.md": "resources/pi-coding-agent/README.md",
      "node_modules/@mariozechner/pi-coding-agent/CHANGELOG.md":
        "resources/pi-coding-agent/CHANGELOG.md",
      "node_modules/@mariozechner/pi-coding-agent/docs": "resources/pi-coding-agent/docs",
      "node_modules/@mariozechner/pi-coding-agent/examples": "resources/pi-coding-agent/examples",
      "node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/assets":
        "resources/pi-coding-agent/dist/modes/interactive/assets",
      "node_modules/@mariozechner/pi-coding-agent/dist/modes/interactive/theme":
        "resources/pi-coding-agent/dist/modes/interactive/theme",
      "node_modules/@mariozechner/pi-coding-agent/dist/core/export-html":
        "resources/pi-coding-agent/dist/core/export-html",
      ...sherpaOnnxCopyEntries,
    },
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    linux: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
    win: {
      bundleCEF: true,
      defaultRenderer: "cef",
    },
  },
  release: {
    baseUrl: "https://github.com/IgorWarzocha/howcode/releases/latest/download",
  },
} satisfies ElectrobunConfig;
