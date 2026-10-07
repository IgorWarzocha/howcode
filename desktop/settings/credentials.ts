import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AuthOperationOptions, Credential, CredentialStore } from '@earendil-works/pi-ai'
import * as Schema from 'effect/Schema'
import lockfile from 'proper-lockfile'

const CredentialSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('api_key'),
    key: Schema.optionalKey(Schema.String),
    env: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  }),
  Schema.Struct({
    type: Schema.Literal('oauth'),
    refresh: Schema.String,
    access: Schema.String,
    expires: Schema.Number,
  }),
])
const decodeCredential = Schema.decodeUnknownSync(CredentialSchema)
const decodeRecords = Schema.decodeUnknownSync(
  Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
)

export class FileCredentialStore implements CredentialStore {
  private readonly filePath: string
  constructor(filePath: string) {
    this.filePath = filePath
  }

  private async load(): Promise<Record<string, Credential>> {
    try {
      // Preserve provider-specific OAuth fields alongside the validated public fields.
      const records = decodeRecords(JSON.parse(await readFile(this.filePath, 'utf8')))
      return Object.fromEntries(
        Object.entries(records).map(([provider, record]) => [
          provider,
          { ...record, ...decodeCredential(record) },
        ]),
      )
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {}
      throw error
    }
  }

  async read(providerId: string, options?: AuthOperationOptions) {
    options?.signal?.throwIfAborted()
    return (await this.load())[providerId]
  }

  async list(options?: AuthOperationOptions) {
    options?.signal?.throwIfAborted()
    return Object.entries(await this.load()).map(([providerId, credential]) => ({
      providerId,
      type: credential.type,
    }))
  }

  private async mutate<T>(
    operation: (credentials: Record<string, Credential>) => Promise<T>,
    options?: AuthOperationOptions,
  ): Promise<T> {
    options?.signal?.throwIfAborted()
    await mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 })
    let compromised: Error | undefined
    const release = await lockfile.lock(this.filePath, {
      realpath: false,
      retries: { retries: 30, minTimeout: 50, maxTimeout: 1000 },
      stale: 30000,
      onCompromised: (error) => {
        compromised = error
      },
    })
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`
    try {
      options?.signal?.throwIfAborted()
      const credentials = await this.load()
      const result = await operation(credentials)
      options?.signal?.throwIfAborted()
      if (compromised) throw compromised
      await writeFile(temporaryPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 })
      await rename(temporaryPath, this.filePath)
      return result
    } finally {
      try {
        await rm(temporaryPath, { force: true })
      } finally {
        await release()
      }
    }
  }

  modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
    options?: AuthOperationOptions,
  ) {
    return this.mutate(async (credentials) => {
      const next = await fn(credentials[providerId])
      if (next !== undefined) credentials[providerId] = next
      return credentials[providerId]
    }, options)
  }

  delete(providerId: string, options?: AuthOperationOptions) {
    return this.mutate(async (credentials) => {
      delete credentials[providerId]
    }, options)
  }
}
