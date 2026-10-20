import * as Schema from 'effect/Schema'

/** Safe standalone launch facts, not a copy of the host's argv or environment. */
export const DesktopLaunchSchema = Schema.Struct({
  executable: Schema.String,
  args: Schema.Array(Schema.String),
  cwd: Schema.String,
  environment: Schema.Struct({
    HOWCODE_REPO_ROOT: Schema.String,
    HOWCODE_RENDERER_ROOT: Schema.String,
  }),
})

export type DesktopLaunch = typeof DesktopLaunchSchema.Type
export const desktopLaunchEnvironmentKey = 'HOWCODE_STANDALONE_LAUNCH'
