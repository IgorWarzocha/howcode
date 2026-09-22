/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue, type SQLOutputValue } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import worker from './index'

const migrationPath = fileURLToPath(new URL('../migrations/0001_initial.sql', import.meta.url).href)
const migration = readFileSync(migrationPath, 'utf8')
const legacyPreflightSql =
  'SELECT COUNT(*) AS count FROM poll_vote_events WHERE voter_hash = ? AND created_at > ?'
const openDatabases: DatabaseSync[] = []

function d1Result<T>(results: T[], changes = 0): D1Result<T> {
  return {
    success: true,
    results,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: changes,
      last_row_id: 0,
      changed_db: changes > 0,
      changes,
    },
  }
}

function d1Row<T>(row: Record<string, SQLOutputValue>): T {
  return row as T
}

function sqlInput(value: unknown): SQLInputValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    value instanceof Uint8Array
  ) {
    return value
  }
  throw new Error(`Unsupported D1 test binding: ${typeof value}`)
}

class ReadBarrier {
  private arrived = 0
  private release: (() => void) | null = null
  private readonly released: Promise<void>

  private readonly expected: number

  constructor(expected: number) {
    this.expected = expected
    this.released = new Promise((resolve) => {
      this.release = resolve
    })
  }

  wait() {
    this.arrived += 1
    if (this.arrived > this.expected) throw new Error('Too many reads reached the barrier.')
    if (this.arrived === this.expected) {
      const release = this.release
      if (!release) throw new Error('Read barrier was not initialized.')
      release()
    }
    return this.released
  }
}

class TestStatement implements D1PreparedStatement {
  private readonly database: DatabaseSync
  private readonly preflightBarrier: ReadBarrier | null
  readonly query: string
  readonly values: SQLInputValue[]

  constructor(
    database: DatabaseSync,
    query: string,
    preflightBarrier: ReadBarrier | null,
    values: SQLInputValue[] = [],
  ) {
    this.database = database
    this.query = query
    this.preflightBarrier = preflightBarrier
    this.values = values
  }

  bind(...values: unknown[]) {
    return new TestStatement(this.database, this.query, this.preflightBarrier, values.map(sqlInput))
  }

  async first<T = unknown>(columnName?: string): Promise<T | null> {
    const row = this.database.prepare(this.query).get(...this.values) ?? null
    if (this.query === legacyPreflightSql && this.preflightBarrier) {
      await this.preflightBarrier.wait()
    }
    if (!row) return null
    if (columnName) return row[columnName] as T
    return d1Row<T>(row)
  }

  all<T = Record<string, unknown>>() {
    const results = this.database
      .prepare(this.query)
      .all(...this.values)
      .map((row) => d1Row<T>(row))
    return Promise.resolve(d1Result(results))
  }

  run<T = Record<string, unknown>>() {
    return Promise.resolve(this.execute<T>())
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    void options
    throw new Error('Raw D1 queries are outside this fixture.')
  }

  execute<T>() {
    const result = this.database.prepare(this.query).run(...this.values)
    return d1Result<T>([], Number(result.changes))
  }
}

class TestDatabase implements D1Database {
  private batchQueue = Promise.resolve()
  private preflightBarrier: ReadBarrier | null = null
  readonly sqlite: DatabaseSync

  constructor(sqlite: DatabaseSync) {
    this.sqlite = sqlite
  }

  interleaveNextPreflightReads(expected: number) {
    this.preflightBarrier = new ReadBarrier(expected)
  }

  prepare(query: string) {
    return new TestStatement(this.sqlite, query, this.preflightBarrier)
  }

  batch<T = unknown>(statements: D1PreparedStatement[]) {
    const result = this.batchQueue.then(() => {
      this.sqlite.exec('BEGIN IMMEDIATE')
      try {
        const results = statements.map((statement) => {
          if (!(statement instanceof TestStatement)) {
            throw new Error('Unexpected statement implementation in D1 test batch.')
          }
          return statement.execute<T>()
        })
        this.sqlite.exec('COMMIT')
        return results
      } catch (error) {
        this.sqlite.exec('ROLLBACK')
        throw error
      }
    })
    this.batchQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  exec(): Promise<D1ExecResult> {
    throw new Error('D1 exec is outside this fixture.')
  }

  withSession(): D1DatabaseSession {
    throw new Error('D1 sessions are outside this fixture.')
  }

  dump(): Promise<ArrayBuffer> {
    throw new Error('D1 dumps are outside this fixture.')
  }
}

function createDatabase() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(migration)
  openDatabases.push(sqlite)
  return new TestDatabase(sqlite)
}

function vote(database: TestDatabase, optionId = 'sibling-suffix') {
  const request = new Request('https://polls.example/vote', {
    method: 'POST',
    headers: {
      'cf-connecting-ip': '203.0.113.10',
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      'user-agent': 'poll-contract-test',
    },
    body: JSON.stringify({ pollId: 'worktree-layout', optionId }),
  })
  return worker.fetch(request, {
    DB: database,
    VOTER_HASH_SECRET: 'test-secret',
  })
}

async function castVotes(database: TestDatabase, count: number) {
  const responses: Response[] = []
  for (let attempt = 0; attempt < count; attempt += 1) {
    responses.push(await vote(database))
  }
  return responses
}

function readOptionId(row: unknown) {
  if (!row || typeof row !== 'object' || !('optionId' in row)) {
    throw new Error('Expected an optionId row.')
  }
  if (typeof row.optionId !== 'string') throw new Error('Expected a string optionId.')
  return row.optionId
}

function eventOptionIds(database: TestDatabase) {
  return database.sqlite
    .prepare('SELECT option_id AS optionId FROM poll_vote_events ORDER BY id ASC')
    .all()
    .map(readOptionId)
}

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.close()
})

describe('poll vote admission', () => {
  it('preserves the existing ninth-attempt admission boundary', async () => {
    const database = createDatabase()

    const admitted = await castVotes(database, 9)
    const rejected = await vote(database)

    expect(admitted.map((response) => response.status)).toEqual(new Array(9).fill(200))
    expect(rejected.status).toBe(429)
    expect(eventOptionIds(database)).toHaveLength(9)
  })

  it('atomically admits only one concurrent request at the boundary', async () => {
    const database = createDatabase()
    await castVotes(database, 8)
    database.interleaveNextPreflightReads(4)

    const responses = await Promise.all([
      vote(database, 'hidden-local-hub'),
      vote(database, 'bare-repo-family'),
      vote(database, 'project-local-hidden'),
      vote(database, 'zed-visible-hub'),
    ])
    const events = eventOptionIds(database)
    const selectedOptionId = readOptionId(
      database.sqlite.prepare('SELECT option_id AS optionId FROM poll_votes').get(),
    )

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1)
    expect(responses.filter((response) => response.status === 429)).toHaveLength(3)
    expect(events).toHaveLength(9)
    expect(selectedOptionId).toBe(events.at(-1))
  })
})
