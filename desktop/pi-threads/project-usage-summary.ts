import type {
  ProjectUsageSessionSummary,
  ProjectUsageSummary,
} from '../../shared/desktop-contracts.ts'
import { readRuntimeEntries, readRuntimeUsage } from '../durable-runtime/host.ts'
import { getProjectStoredUsageTotals, listProjectUsageConversations } from '../thread-state-db.ts'
import { ensureConversationProjection } from './conversation-projection.ts'
import { mapWithConcurrency } from './map-with-concurrency.ts'

export async function loadProjectUsageSummary(projectId: string): Promise<ProjectUsageSummary> {
  await ensureConversationProjection()
  const stored = getProjectStoredUsageTotals(projectId)
  const conversations = listProjectUsageConversations(projectId)
  const sessions = await mapWithConcurrency(
    [...conversations],
    6,
    async (conversation): Promise<ProjectUsageSessionSummary> => {
      const [usage, entries] = await Promise.all([
        readRuntimeUsage(conversation.conversationId),
        readRuntimeEntries(conversation.conversationId),
      ])
      const summary: ProjectUsageSessionSummary = {
        threadId: conversation.id,
        title: conversation.title,
        conversationId: conversation.conversationId,
        lastModifiedMs: conversation.lastModifiedMs,
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        costTotal: 0,
        assistantTurnCount: entries
          .filter((entry) => String(entry.conversationId) === conversation.conversationId)
          .reduce(
            (count, entry) =>
              count + (entry.model?.filter((message) => message.role === 'assistant').length ?? 0),
            0,
          ),
      }
      for (const bucket of [usage.models, usage.tools]) {
        for (const item of Object.values(bucket)) {
          summary.input += item.input
          summary.output += item.output
          summary.cacheRead += item.cacheRead
          summary.cacheWrite += item.cacheWrite
          summary.totalTokens += item.totalTokens
          summary.costTotal += item.cost.total
        }
      }
      return summary
    },
  )
  const summary: ProjectUsageSummary = {
    projectId,
    sessionCount: sessions.length + (stored?.sessionCount ?? 0),
    sessionsWithUsageCount:
      sessions.filter((session) => session.totalTokens > 0).length +
      (stored?.sessionsWithUsageCount ?? 0),
    input: stored?.input ?? 0,
    output: stored?.output ?? 0,
    cacheRead: stored?.cacheRead ?? 0,
    cacheWrite: stored?.cacheWrite ?? 0,
    totalTokens: stored?.totalTokens ?? 0,
    costTotal: stored?.costTotal ?? 0,
    assistantTurnCount: stored?.assistantTurnCount ?? 0,
    topSessions: [...sessions]
      .filter((session) => session.totalTokens > 0)
      .sort((a, b) => b.costTotal - a.costTotal || b.totalTokens - a.totalTokens)
      .slice(0, 10),
  }
  for (const session of sessions) {
    summary.input += session.input
    summary.output += session.output
    summary.cacheRead += session.cacheRead
    summary.cacheWrite += session.cacheWrite
    summary.totalTokens += session.totalTokens
    summary.costTotal += session.costTotal
    summary.assistantTurnCount += session.assistantTurnCount
  }
  return summary
}
