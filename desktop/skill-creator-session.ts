import type { SkillCreatorSessionState } from '../shared/desktop-contracts.ts'
import { invokeRuntimeHost } from './runtime-host/client-bridge.ts'

export function startSkillCreatorSession(request: {
  prompt: string
  local?: boolean | undefined
  projectPath?: string | undefined | null | undefined
}): Promise<SkillCreatorSessionState> {
  return invokeRuntimeHost('startSkillCreatorSession', request)
}

export function continueSkillCreatorSession(request: {
  sessionId: string
  prompt: string
}): Promise<SkillCreatorSessionState> {
  return invokeRuntimeHost('continueSkillCreatorSession', request)
}

export function closeSkillCreatorSession(request: { sessionId: string }): Promise<{ ok: boolean }> {
  return invokeRuntimeHost('closeSkillCreatorSession', request)
}
