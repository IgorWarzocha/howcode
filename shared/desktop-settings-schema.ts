import * as Schema from 'effect/Schema'

export const PiSettingsSchema = Schema.Struct({
  theme: Schema.String,
  autoCompact: Schema.Boolean,
  enableSkillCommands: Schema.Boolean,
  blockImages: Schema.Boolean,
  transport: Schema.Literals(['sse', 'websocket', 'websocket-cached', 'auto']),
  steeringMode: Schema.Literals(['all', 'one-at-a-time']),
  followUpMode: Schema.Literals(['all', 'one-at-a-time']),
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
