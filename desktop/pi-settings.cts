import type { PiSettings } from "../shared/desktop-contracts.ts";
import { invalidateRuntimeHostSettings, invokeRuntimeHost } from "./runtime-host/client-bridge.cts";

export type PiSettingsKey = keyof PiSettings;

export function loadPiSettings(projectPath?: string | null): Promise<PiSettings> {
  return invokeRuntimeHost("loadPiSettings", { projectPath: projectPath ?? null });
}

export async function updatePiSetting(
  key: PiSettingsKey,
  value: unknown,
  projectPath?: string | null,
): Promise<PiSettings> {
  const settings = await invokeRuntimeHost("updatePiSetting", {
    key,
    value,
    projectPath: projectPath ?? null,
  });
  await invalidateRuntimeHostSettings({ projectPath: projectPath ?? null });
  return settings;
}
