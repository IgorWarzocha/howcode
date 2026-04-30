import type { PiConfiguredSkill, PiSkillMutationResult } from "../../shared/desktop-contracts.ts";
import {
  invalidateRuntimeHostSettings,
  invokeRuntimeHost,
} from "../runtime-host/client-bridge.cts";

export function listConfiguredPiSkills(
  request: { projectPath?: string | null; chat?: boolean } = {},
): Promise<PiConfiguredSkill[]> {
  return invokeRuntimeHost("listConfiguredPiSkills", request);
}

export async function installPiSkill(request: {
  source: string;
  local?: boolean;
  projectPath?: string | null;
  chat?: boolean;
}): Promise<PiSkillMutationResult> {
  const result = await invokeRuntimeHost("installPiSkill", request);
  await invalidateRuntimeHostSettings({
    projectPath: request.chat ? null : request.local ? request.projectPath : null,
  });
  return result;
}

export async function removePiSkill(request: {
  installedPath: string;
  projectPath?: string | null;
  chat?: boolean;
}): Promise<PiSkillMutationResult> {
  const result = await invokeRuntimeHost("removePiSkill", request);
  await invalidateRuntimeHostSettings();
  return result;
}
