import type { PiSettings } from "../shared/desktop-contracts.ts";
import { invokeRuntimeHost } from "./runtime-host/client.cts";

export type PiSettingsKey = keyof PiSettings;

export function loadPiSettings(projectPath?: string | null): Promise<PiSettings> {
  return invokeRuntimeHost("loadPiSettings", { projectPath: projectPath ?? null });
}

export function updatePiSetting(
  key: PiSettingsKey,
  value: unknown,
  projectPath?: string | null,
): Promise<PiSettings> {
  return invokeRuntimeHost("updatePiSetting", { key, value, projectPath: projectPath ?? null });
}
