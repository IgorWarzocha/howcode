import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { ProjectUsageSessionSummary } from '../../shared/desktop-contracts.ts'
import { decodeSessionFileLine, type SessionFileEntry } from './session-entry-schema.ts'

type UsageTotals = Pick<
  ProjectUsageSessionSummary,
  | 'input'
  | 'output'
  | 'cacheRead'
  | 'cacheWrite'
  | 'totalTokens'
  | 'costTotal'
  | 'assistantTurnCount'
>

function finiteNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getBillableUsage(entry: SessionFileEntry | null) {
  if (!entry) return undefined
  if (entry.type === 'usage' || entry.type === 'compaction' || entry.type === 'branch_summary') {
    return entry.usage
  }
  if (
    entry.type === 'message' &&
    (entry.message?.role === 'assistant' || entry.message?.role === 'toolResult')
  ) {
    return entry.message.usage
  }
  return undefined
}

// Both the live summary and the ledger retained after deletion use this accounting policy.
export async function readSessionUsage(sessionPath: string): Promise<UsageTotals> {
  const totals: UsageTotals = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    costTotal: 0,
    assistantTurnCount: 0,
  }
  const lines = createInterface({
    input: createReadStream(sessionPath, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  for await (const line of lines) {
    const entry = decodeSessionFileLine(line)
    const usage = getBillableUsage(entry)
    if (!usage) continue
    totals.input += finiteNumber(usage.input)
    totals.output += finiteNumber(usage.output)
    totals.cacheRead += finiteNumber(usage.cacheRead)
    totals.cacheWrite += finiteNumber(usage.cacheWrite)
    totals.totalTokens += finiteNumber(usage.totalTokens)
    totals.costTotal += finiteNumber(usage.cost?.total)
    if (entry?.type === 'message' && entry.message?.role === 'assistant') {
      totals.assistantTurnCount += 1
    }
  }
  return totals
}
