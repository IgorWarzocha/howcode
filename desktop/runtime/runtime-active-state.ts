import { isHeadlessExtensionCommandRunning } from './agent-session-extensions.ts'
import type { PiRuntime } from './types.ts'

export function isRuntimeBranchSummaryRunning(runtime: PiRuntime) {
  return runtime.session.isCompacting && isHeadlessExtensionCommandRunning(runtime.session)
}

export function isRuntimeCompactingContext(runtime: PiRuntime) {
  return runtime.session.isCompacting && !isRuntimeBranchSummaryRunning(runtime)
}
