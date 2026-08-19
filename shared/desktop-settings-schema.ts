import * as Schema from 'effect/Schema'

export const PiSettingsSchema = Schema.Struct({
  extensions: Schema.mutable(Schema.Array(Schema.String)),
  theme: Schema.String,
  autoCompact: Schema.Boolean,
  enableSkillCommands: Schema.Boolean,
  hideThinkingBlock: Schema.Boolean,
  quietStartup: Schema.Boolean,
  showImages: Schema.Boolean,
  autoResizeImages: Schema.Boolean,
  blockImages: Schema.Boolean,
  collapseChangelog: Schema.Boolean,
  enableInstallTelemetry: Schema.Boolean,
  showHardwareCursor: Schema.Boolean,
  clearOnShrink: Schema.Boolean,
  transport: Schema.Literals(['sse', 'websocket', 'auto']),
  steeringMode: Schema.Literals(['all', 'one-at-a-time']),
  followUpMode: Schema.Literals(['all', 'one-at-a-time']),
  doubleEscapeAction: Schema.Literals(['fork', 'tree', 'none']),
  defaultProjectTrust: Schema.Literals(['ask', 'always', 'never']),
  treeFilterMode: Schema.Literals(['default', 'no-tools', 'user-only', 'labeled-only', 'all']),
  editorPaddingX: Schema.Number,
  autocompleteMaxVisible: Schema.Number,
  imageWidthCells: Schema.Number,
})

export const PiThemeStateSchema = Schema.Struct({
  selectedTheme: Schema.String,
  themes: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        name: Schema.String,
        label: Schema.String,
        source: Schema.Literals(['howcode', 'pi-builtin', 'pi-json']),
        path: Schema.optionalKey(Schema.String),
      }),
    ),
  ),
  colors: Schema.Record(Schema.String, Schema.String),
  exportColors: Schema.Struct({
    pageBg: Schema.optionalKey(Schema.String),
    cardBg: Schema.optionalKey(Schema.String),
    infoBg: Schema.optionalKey(Schema.String),
  }),
  isLight: Schema.Boolean,
  diagnostics: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        type: Schema.String,
        message: Schema.String,
        path: Schema.optionalKey(Schema.String),
      }),
    ),
  ),
})
