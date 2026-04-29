import type {
  PiPackageMutationResult,
  PiConfiguredPackage,
} from "../../shared/desktop-contracts.ts";
import { invokeRuntimeHost } from "../runtime-host/client.cts";

export function listConfiguredPiPackages(
  request: { projectPath?: string | null } = {},
): Promise<PiConfiguredPackage[]> {
  return invokeRuntimeHost("listConfiguredPiPackages", request);
}

export function installPiPackage(request: {
  source: string;
  kind?: "npm" | "git";
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiPackageMutationResult> {
  return invokeRuntimeHost("installPiPackage", request);
}

export function removePiPackage(request: {
  source: string;
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiPackageMutationResult> {
  return invokeRuntimeHost("removePiPackage", request);
}
