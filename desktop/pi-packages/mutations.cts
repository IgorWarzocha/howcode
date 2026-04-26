import type { PiPackageMutationResult } from "../../shared/desktop-contracts.ts";
import { listConfiguredPiPackages } from "./configured.cts";
import { normalizePiPackageSource } from "./helpers.ts";
import { getPiPackageServices } from "./services.cts";
import { markRuntimeSettingsStaleForProject } from "../runtime/runtime-registry.cts";

export async function installPiPackage(request: {
  source: string;
  kind?: "npm" | "git";
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiPackageMutationResult> {
  const normalizedSource = normalizePiPackageSource(request.source, request.kind ?? "npm");

  if (!normalizedSource) {
    throw new Error("Enter a package source.");
  }

  const { packageManager } = await getPiPackageServices(request.projectPath);
  await packageManager.installAndPersist(normalizedSource, request.local ? { local: true } : {});
  await markRuntimeSettingsStaleForProject(request.local ? request.projectPath : null);

  return {
    source: request.source,
    normalizedSource,
    configuredPackages: await listConfiguredPiPackages({
      projectPath: request.projectPath ?? null,
    }),
  };
}

export async function removePiPackage(request: {
  source: string;
  local?: boolean;
  projectPath?: string | null;
}): Promise<PiPackageMutationResult> {
  const source = request.source.trim();

  if (source.length === 0) {
    throw new Error("Choose a package to remove.");
  }

  const { packageManager } = await getPiPackageServices(request.projectPath);
  await packageManager.removeAndPersist(source, request.local ? { local: true } : {});
  await markRuntimeSettingsStaleForProject(request.local ? request.projectPath : null);

  return {
    source,
    normalizedSource: source,
    configuredPackages: await listConfiguredPiPackages({
      projectPath: request.projectPath ?? null,
    }),
  };
}
