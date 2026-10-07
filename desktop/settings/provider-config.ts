import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createProvider, envApiKeyAuth, lazyApi, type MutableModels } from '@earendil-works/pi-ai'
import * as Schema from 'effect/Schema'

const ApiSchema = Schema.Literals([
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
  'google-generative-ai',
  'mistral-conversations',
  'azure-openai-responses',
  'openai-codex-responses',
  'bedrock-converse-stream',
  'google-vertex',
  'pi-messages',
])
const CostSchema = Schema.Struct({
  tiers: Schema.optionalKey(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          inputTokensAbove: Schema.Number,
          input: Schema.Number,
          output: Schema.Number,
          cacheRead: Schema.Number,
          cacheWrite: Schema.Number,
        }),
      ),
    ),
  ),
  input: Schema.Number,
  output: Schema.Number,
  cacheRead: Schema.Number,
  cacheWrite: Schema.Number,
})
const ModelSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.optionalKey(Schema.String),
  api: Schema.optionalKey(ApiSchema),
  reasoning: Schema.optionalKey(Schema.Boolean),
  thinkingLevelMap: Schema.optionalKey(Schema.Record(Schema.String, Schema.NullOr(Schema.String))),
  samplingParams: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  input: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.Literals(['text', 'image'])))),
  cost: Schema.optionalKey(CostSchema),
  contextWindow: Schema.optionalKey(Schema.Number),
  maxTokens: Schema.optionalKey(Schema.Number),
  headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  compat: Schema.optionalKey(
    Schema.Struct({
      supportsStore: Schema.optionalKey(Schema.Boolean),
      supportsDeveloperRole: Schema.optionalKey(Schema.Boolean),
      supportsReasoningEffort: Schema.optionalKey(Schema.Boolean),
      supportsUsageInStreaming: Schema.optionalKey(Schema.Boolean),
      supportsFinishReason: Schema.optionalKey(Schema.Boolean),
      supportsLongCacheRetention: Schema.optionalKey(Schema.Boolean),
      requiresToolResultName: Schema.optionalKey(Schema.Boolean),
      requiresAssistantAfterToolResult: Schema.optionalKey(Schema.Boolean),
      requiresThinkingAsText: Schema.optionalKey(Schema.Boolean),
      requiresReasoningContentOnAssistantMessages: Schema.optionalKey(Schema.Boolean),
      supportsStrictMode: Schema.optionalKey(Schema.Boolean),
      supportsOpenAIGrammarTools: Schema.optionalKey(Schema.Boolean),
      supportsAdditionalTools: Schema.optionalKey(Schema.Boolean),
      supportsToolSearch: Schema.optionalKey(Schema.Boolean),
      supportsStrictTools: Schema.optionalKey(Schema.Boolean),
      supportsTemperature: Schema.optionalKey(Schema.Boolean),
      supportsMidConvoSystemMessages: Schema.optionalKey(Schema.Boolean),
      maxTokensField: Schema.optionalKey(Schema.Literals(['max_completion_tokens', 'max_tokens'])),
      thinkingFormat: Schema.optionalKey(
        Schema.Literals([
          'openai',
          'openrouter',
          'deepseek',
          'together',
          'baseten',
          'zai',
          'qwen',
          'chat-template',
          'qwen-chat-template',
          'string-thinking',
          'ant-ling',
        ]),
      ),
    }),
  ),
})
const ProviderSchema = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  compat: ModelSchema.fields.compat,
  baseUrl: Schema.optionalKey(Schema.String),
  apiKey: Schema.optionalKey(Schema.String),
  api: Schema.optionalKey(ApiSchema),
  headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  models: Schema.optionalKey(Schema.Array(ModelSchema)),
})
const ConfigSchema = Schema.Struct({ providers: Schema.Record(Schema.String, ProviderSchema) })
const decodeConfig = Schema.decodeUnknownSync(ConfigSchema)
const apiImplementations = {
  'openai-completions': lazyApi(() => import('@earendil-works/pi-ai/api/openai-completions')),
  'openai-responses': lazyApi(() => import('@earendil-works/pi-ai/api/openai-responses')),
  'anthropic-messages': lazyApi(() => import('@earendil-works/pi-ai/api/anthropic-messages')),
  'google-generative-ai': lazyApi(() => import('@earendil-works/pi-ai/api/google-generative-ai')),
  'mistral-conversations': lazyApi(() => import('@earendil-works/pi-ai/api/mistral-conversations')),
  'azure-openai-responses': lazyApi(
    () => import('@earendil-works/pi-ai/api/azure-openai-responses'),
  ),
  'openai-codex-responses': lazyApi(
    () => import('@earendil-works/pi-ai/api/openai-codex-responses'),
  ),
  'bedrock-converse-stream': lazyApi(
    () => import('@earendil-works/pi-ai/api/bedrock-converse-stream'),
  ),
  'google-vertex': lazyApi(() => import('@earendil-works/pi-ai/api/google-vertex')),
  'pi-messages': lazyApi(() => import('@earendil-works/pi-ai/api/pi-messages')),
}

async function readConfiguration(directory: string) {
  try {
    return decodeConfig(JSON.parse(await readFile(path.join(directory, 'models.json'), 'utf8')), {
      onExcessProperty: 'error',
    })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw error
  }
}

export async function applyProviderConfiguration(models: MutableModels, directory: string) {
  // Unrecognized compatibility knobs must fail visibly rather than disappear during migration.
  const config = await readConfiguration(directory)
  if (!config) return
  for (const [id, configured] of Object.entries(config.providers)) {
    const base = models.getProvider(id)
    const baseline = [...(base?.getModels() ?? [])]
    const additions = (configured.models ?? []).map((model) => {
      const previous = baseline.find((known) => known.id === model.id)
      const api = model.api ?? configured.api ?? previous?.api
      if (!api) throw new Error(`Custom model ${id}/${model.id} needs an api`)
      const baseUrl = configured.baseUrl ?? previous?.baseUrl ?? base?.baseUrl
      if (!baseUrl) throw new Error(`Custom model ${id}/${model.id} needs a baseUrl`)
      return {
        ...previous,
        ...model,
        api,
        provider: id,
        baseUrl,
        name: model.name ?? previous?.name ?? model.id,
        reasoning: model.reasoning ?? previous?.reasoning ?? false,
        input: model.input ?? previous?.input ?? ['text' as const],
        cost: model.cost ?? previous?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: model.contextWindow ?? previous?.contextWindow ?? 128000,
        maxTokens: model.maxTokens ?? previous?.maxTokens ?? 16384,
      }
    })
    const catalog = [
      ...baseline.filter((model) => !additions.some((added) => added.id === model.id)),
      ...additions,
    ].map((model) => ({
      ...model,
      ...(configured.compat ? { compat: { ...configured.compat, ...model.compat } } : {}),
      ...(configured.baseUrl ? { baseUrl: configured.baseUrl } : {}),
      ...(configured.headers ? { headers: { ...model.headers, ...configured.headers } } : {}),
    }))
    if (configured.apiKey?.startsWith('!'))
      throw new Error(
        `Command-valued credentials for ${id} are not supported. Configure an environment variable or stored credential.`,
      )
    const auth = configured.apiKey
      ? {
          apiKey: {
            name: 'Configured API key',
            async resolve() {
              return {
                auth: { apiKey: process.env[configured.apiKey ?? ''] ?? configured.apiKey ?? '' },
                source: 'models.json',
              }
            },
            async check() {
              return { type: 'api_key' as const, source: 'models.json' }
            },
          },
        }
      : (base?.auth ?? { apiKey: envApiKeyAuth(id, []) })
    if (base && additions.length === 0) {
      models.setProvider({
        ...base,
        name: configured.name ?? base.name,
        auth,
        getModels: () => catalog,
      })
    } else {
      models.setProvider(
        createProvider({
          id,
          name: configured.name ?? id,
          auth,
          models: catalog,
          api: apiImplementations,
        }),
      )
    }
  }
}
