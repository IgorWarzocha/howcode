import * as Schema from 'effect/Schema'

const AuthType = Schema.Literals(['api_key', 'oauth'])
const SessionId = Schema.String.check(Schema.isUUID())
export const ProviderAuthRequest = Schema.Union([
  Schema.Struct({ operation: Schema.Literal('list') }),
  Schema.Struct({ operation: Schema.Literal('logout'), provider: Schema.NonEmptyString }),
  Schema.Struct({
    operation: Schema.Literal('start'),
    provider: Schema.NonEmptyString,
    authType: AuthType,
  }),
  Schema.Struct({ operation: Schema.Literals(['read', 'cancel']), sessionId: SessionId }),
  Schema.Struct({
    operation: Schema.Literal('answer'),
    sessionId: SessionId,
    promptId: SessionId,
    value: Schema.String,
  }),
])
export type ProviderAuthRequest = typeof ProviderAuthRequest.Type

const Link = Schema.Struct({ url: Schema.String, label: Schema.optionalKey(Schema.String) })
export const ProviderAuthNotice = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('info'),
    message: Schema.String,
    links: Schema.optionalKey(Schema.Array(Link)),
  }),
  Schema.Struct({
    type: Schema.Literal('auth_url'),
    url: Schema.String,
    instructions: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal('device_code'),
    userCode: Schema.String,
    verificationUri: Schema.String,
  }),
  Schema.Struct({ type: Schema.Literal('progress'), message: Schema.String }),
])
const PromptFields = { id: SessionId, message: Schema.String }
export const ProviderAuthPrompt = Schema.Union([
  Schema.Struct({
    ...PromptFields,
    type: Schema.Literals(['text', 'secret', 'manual_code']),
    placeholder: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({
    ...PromptFields,
    type: Schema.Literal('select'),
    options: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        label: Schema.String,
        description: Schema.optionalKey(Schema.String),
      }),
    ),
  }),
])
export type ProviderAuthPrompt = typeof ProviderAuthPrompt.Type
export const ProviderAccount = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  available: Schema.Boolean,
  methods: Schema.Array(Schema.Struct({ type: AuthType, label: Schema.String })),
  source: Schema.NullOr(Schema.String),
  stored: Schema.Boolean,
})
export type ProviderAccount = typeof ProviderAccount.Type
export const ProviderAuthSession = Schema.Struct({
  sessionId: SessionId,
  revision: Schema.Number,
  status: Schema.Literals(['running', 'success', 'cancelled', 'error']),
  message: Schema.String,
  notices: Schema.Array(ProviderAuthNotice),
  prompt: Schema.NullOr(ProviderAuthPrompt),
})
export type ProviderAuthSession = typeof ProviderAuthSession.Type
export const ProviderAuthResponse = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('accounts'),
    accounts: Schema.Array(ProviderAccount),
    directory: Schema.String,
  }),
  Schema.Struct({ type: Schema.Literal('session'), session: ProviderAuthSession }),
])
export type ProviderAuthResponse = typeof ProviderAuthResponse.Type
