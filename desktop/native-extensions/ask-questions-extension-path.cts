import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDesktopUserDataPath } from "../user-data-path.cts";

const extensionFileName = "howcode-native-ask-questions.mjs";

export function getBundledAskQuestionsExtensionPath() {
  const candidates = [
    fileURLToPath(new URL(`./native-extensions/${extensionFileName}`, import.meta.url)),
    fileURLToPath(new URL(`./${extensionFileName}`, import.meta.url)),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[1];
}

export function ensureAskQuestionsExtensionRuntimePath() {
  const sourcePath = getBundledAskQuestionsExtensionPath();
  const targetDirectory = path.join(getDesktopUserDataPath(), "native-extensions");
  const targetPath = path.join(targetDirectory, extensionFileName);
  mkdirSync(targetDirectory, { recursive: true });
  writeFileSync(targetPath, readFileSync(sourcePath, "utf8"), "utf8");
  return targetPath;
}
