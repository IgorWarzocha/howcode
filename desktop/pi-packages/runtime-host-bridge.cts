import type {
  PiPackageMutationResult,
  PiConfiguredPackage,
} from "../../shared/desktop-contracts.ts";
import {
  invalidateRuntimeHostSettings,
  invokeRuntimeHost,
} from "../runtime-host/client-bridge.cts";

export function listConfiguredPiPackages(
  request: { projectPath?: string | null; chat?: boolean } = {},
): Promise<PiConfiguredPackage[]> {
  return invokeRuntimeHost("listConfiguredPiPackages", request);
}

export async function installPiPackage(request: {
  source: string;
  kind?: "npm" | "git";
  local?: boolean;
  projectPath?: string | null;
  chat?: boolean;
}): Promise<PiPackageMutationResult> {
  const result = await invokeRuntimeHost("installPiPackage", request);
  await invalidateRuntimeHostSettings({
    projectPath: request.chat ? null : request.local ? request.projectPath : null,
  });
  return result;
}

export async function removePiPackage(request: {
  source: string;
  local?: boolean;
  projectPath?: string | null;
  chat?: boolean;
}): Promise<PiPackageMutationResult> {
  const result = await invokeRuntimeHost("removePiPackage", request);
  await invalidateRuntimeHostSettings({
    projectPath: request.chat ? null : request.local ? request.projectPath : null,
  });
  return result;
}
