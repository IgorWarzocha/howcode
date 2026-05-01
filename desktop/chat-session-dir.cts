import { mkdirSync } from "node:fs";
import path from "node:path";
import { getDesktopUserDataPath } from "./user-data-path.cts";

export function getChatSessionDir() {
  const sessionDir = path.join(getDesktopUserDataPath(), ".howcode", "chat-sessions");
  mkdirSync(sessionDir, { recursive: true });
  return sessionDir;
}
