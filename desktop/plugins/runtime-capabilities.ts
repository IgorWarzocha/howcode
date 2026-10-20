import type { PluginServiceInstance } from '@howaboua/howcode-sdk/plugins'
import { bindFeatureOperations } from './feature-operations.ts'

export function bindCapabilities(
  native: PluginServiceInstance,
  instance: PluginServiceInstance,
  track: <T>(operation: () => Promise<T>) => Promise<T>,
  assertCurrent: () => void,
) {
  if (native.terminal) instance.terminal = native.terminal
  if (native.isBusy !== undefined) {
    if (typeof native.isBusy !== 'function') throw new Error('Invalid component busy callback.')
    instance.isBusy = native.isBusy.bind(native)
  }
  const leased = <T>(operation: () => Promise<T>) =>
    track(async () => {
      assertCurrent()
      const result = await operation()
      assertCurrent()
      return result
    })
  const workspaceAgent = native.workspaceAgent?.bind(native)
  const conversationAssociation = native.conversationAssociation?.bind(native)
  const deleteConversations = native.deleteConversations?.bind(native)
  const conversationCreated = native.conversationCreated?.bind(native)
  if (conversationCreated)
    instance.conversationCreated = (conversation) => leased(() => conversationCreated(conversation))
  bindInputCapabilities(native, instance, leased)
  const fixedInitiative = native.fixedInitiative
  if (fixedInitiative)
    instance.fixedInitiative = {
      inspect: (...args) => leased(() => fixedInitiative.inspect(...args)),
    }
  const initiativeConfiguration = native.initiativeConfiguration
  if (initiativeConfiguration)
    instance.initiativeConfiguration = {
      inspect: (...args) => leased(() => initiativeConfiguration.inspect(...args)),
      configure: (...args) => leased(() => initiativeConfiguration.configure(...args)),
    }
  const gitProgress = native.gitProgress?.bind(native)
  if (gitProgress) instance.gitProgress = (...args) => leased(() => gitProgress(...args))
  const board = native.board
  if (board)
    instance.board = {
      family: (...args) => leased(() => board.family(...args)),
      enrol: (...args) => leased(() => board.enrol(...args)),
      designateResident: (...args) => leased(() => board.designateResident(...args)),
      grantParticipation: (...args) => leased(() => board.grantParticipation(...args)),
      revokeParticipation: (...args) => leased(() => board.revokeParticipation(...args)),
      ensureSetupThread: (...args) => leased(() => board.ensureSetupThread(...args)),
      recordSetup: (...args) => leased(() => board.recordSetup(...args)),
      threads: (...args) => leased(() => board.threads(...args)),
      threadReference: (...args) => leased(() => board.threadReference(...args)),
    }
  if (workspaceAgent) instance.workspaceAgent = (id) => leased(() => workspaceAgent(id))
  if (conversationAssociation)
    instance.conversationAssociation = (id) => leased(() => conversationAssociation(id))
  if (deleteConversations)
    instance.deleteConversations = (ids) => leased(() => deleteConversations(ids))
  if (native.skills)
    instance.skills = Object.freeze(native.skills.map((skill) => Object.freeze({ ...skill })))
}

function bindInputCapabilities(
  native: PluginServiceInstance,
  instance: PluginServiceInstance,
  leased: <T>(operation: () => Promise<T>) => Promise<T>,
) {
  const policy = native.inputPolicy
  if (policy)
    instance.inputPolicy = {
      evaluate: (...args) => leased(() => policy.evaluate(...args)),
      accepted: (...args) => leased(() => policy.accepted(...args)),
      humanPrompt: (...args) => leased(() => policy.humanPrompt(...args)),
    }
  const inputSource = native.inputSource
  const reconcile = inputSource?.reconcile?.bind(inputSource)
  if (inputSource)
    instance.inputSource = {
      explicitReady: (...args) => leased(() => inputSource.explicitReady(...args)),
      ...(reconcile ? { reconcile: () => leased(reconcile) } : {}),
    }
}

export function bindOperationCapabilities(
  owner: string,
  native: PluginServiceInstance,
  instance: PluginServiceInstance,
  track: <T>(operation: () => Promise<T>) => Promise<T>,
  assertCurrent: () => void,
) {
  if (!native.operations) return undefined
  const operations = native.operations.map((operation) => ({
    ...operation,
    execute: (...args: Parameters<typeof operation.execute>) =>
      track(async () => {
        assertCurrent()
        return operation.execute(...args)
      }),
  }))
  const release = bindFeatureOperations(owner, operations)
  instance.operations = operations
  return release
}
