import type {
  PiConfiguredPackage,
  PiPackageMutationResult,
} from '../../shared/desktop-contracts.ts'
import { invalidateRuntimeHostSettings, invokeRuntimeHost } from '../runtime-host/client-bridge.ts'

export function listConfiguredPiPackages(
  request: { projectPath?: string | undefined | null | undefined; chat?: boolean | undefined } = {},
): Promise<PiConfiguredPackage[]> {
  return invokeRuntimeHost('listConfiguredPiPackages', request)
}

export async function installPiPackage(request: {
  source: string
  kind?: 'npm' | 'git' | undefined
  local?: boolean | undefined
  projectPath?: string | undefined | null | undefined
  chat?: boolean | undefined
}): Promise<PiPackageMutationResult> {
  const result = await invokeRuntimeHost('installPiPackage', request)
  await invalidateRuntimeHostSettings({
    projectPath: request.chat ? null : request.local ? request.projectPath : null,
  })
  return result
}

export async function removePiPackage(request: {
  source: string
  local?: boolean | undefined
  projectPath?: string | undefined | null | undefined
  chat?: boolean | undefined
}): Promise<PiPackageMutationResult> {
  const result = await invokeRuntimeHost('removePiPackage', request)
  await invalidateRuntimeHostSettings({
    projectPath: request.chat ? null : request.local ? request.projectPath : null,
  })
  return result
}
