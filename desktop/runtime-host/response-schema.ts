import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import {
  ComposerSkillReferenceSchema,
  ComposerSlashCommandSchema,
  ComposerStateSchema,
} from '../../shared/desktop-composer-schema.ts'
import {
  PiConfiguredPackageSchema,
  PiConfiguredSkillSchema,
  PiPackageMutationResultSchema,
  PiSkillMutationResultSchema,
} from '../../shared/desktop-package-schema.ts'
import { PiSettingsSchema, PiThemeStateSchema } from '../../shared/desktop-settings-schema.ts'
import { ThreadDataSchema } from '../../shared/desktop-thread-schema.ts'
import { SessionTreeListSchema } from '../../shared/session-tree-schema.ts'
import { ThreadSearchResultSchema } from '../../shared/thread-search-schema.ts'
import type { RuntimeHostRequestName, RuntimeHostResponseMap } from './protocol.ts'

const OkSchema = Schema.Struct({ ok: Schema.Literal(true) })
const ThreadSnapshotSchema = Schema.Struct({
  projectId: Schema.String,
  threadId: Schema.String,
  thread: ThreadDataSchema,
})

const runtimeHostResponseSchemas = {
  getComposerState: ComposerStateSchema,
  getComposerSlashCommands: Schema.mutable(Schema.Array(ComposerSlashCommandSchema)),
  getComposerSkills: Schema.mutable(Schema.Array(ComposerSkillReferenceSchema)),
  startNewThread: Schema.Struct({
    composer: ComposerStateSchema,
    projectId: Schema.String,
    sessionPath: Schema.String,
    threadId: Schema.String,
  }),
  selectProjectRuntime: ComposerStateSchema,
  openThreadRuntime: ComposerStateSchema,
  invalidateRuntimeSettings: OkSchema,
  disposeRuntimeHosts: OkSchema,
  getPiSessionStorage: Schema.Struct({ agentDir: Schema.String, sessionDir: Schema.String }),
  loadPiSettings: PiSettingsSchema,
  loadPiThemeState: PiThemeStateSchema,
  updatePiSetting: PiSettingsSchema,
  listConfiguredPiPackages: Schema.mutable(Schema.Array(PiConfiguredPackageSchema)),
  installPiPackage: PiPackageMutationResultSchema,
  removePiPackage: PiPackageMutationResultSchema,
  listConfiguredPiSkills: Schema.mutable(Schema.Array(PiConfiguredSkillSchema)),
  installPiSkill: PiSkillMutationResultSchema,
  removePiSkill: PiSkillMutationResultSchema,
  loadThreadSnapshot: ThreadSnapshotSchema,
  loadSessionTreeList: SessionTreeListSchema,
  loadThreadPreviewAtEntry: ThreadSnapshotSchema,
  searchThreadSnapshot: ThreadSearchResultSchema,
  renameThreadSession: Schema.Struct({
    projectId: Schema.String,
    threadId: Schema.String,
    title: Schema.String,
  }),
  generateGitCommitMessage: Schema.NullOr(Schema.String),
  setComposerModel: OkSchema,
  setComposerThinkingLevel: OkSchema,
  sendComposerPrompt: Schema.Struct({
    outcome: Schema.Literals(['sent', 'stopped']),
    sessionPath: Schema.NullOr(Schema.String),
    threadId: Schema.NullOr(Schema.String),
  }),
  stopComposerRun: OkSchema,
  dequeueComposerPrompt: Schema.NullOr(Schema.String),
  answerPiExtensionDialog: Schema.Struct({ ok: Schema.Boolean }),
  invokePiExtensionShortcut: Schema.Struct({
    editorSelectionEnd: Schema.optionalKey(Schema.Number),
    editorSelectionStart: Schema.optionalKey(Schema.Number),
    editorText: Schema.optionalKey(Schema.String),
    ok: Schema.Boolean,
  }),
  setProjectTrust: OkSchema,
  labelSessionTreeEntry: OkSchema,
  navigateSessionTree: Schema.Struct({
    cancelled: Schema.Boolean,
    aborted: Schema.optionalKey(Schema.Boolean),
    editorText: Schema.optionalKey(Schema.String),
  }),
} satisfies {
  readonly [K in RuntimeHostRequestName]: Schema.ConstraintDecoder<RuntimeHostResponseMap[K]>
}

export function decodeRuntimeHostResponse<TName extends RuntimeHostRequestName>(
  name: TName,
  value: unknown,
): RuntimeHostResponseMap[TName] {
  const schema = runtimeHostResponseSchemas[name] as unknown as Schema.ConstraintDecoder<
    RuntimeHostResponseMap[TName]
  >
  const decoded = Schema.decodeUnknownResult(schema)(value)
  if (Result.isFailure(decoded)) {
    throw new Error(`Invalid ${name} runtime-host response: ${decoded.failure}`)
  }
  return decoded.success
}
