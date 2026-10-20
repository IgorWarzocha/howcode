import {
  AgentDoc,
  type AgentState,
  type ConversationRecord,
  defineDoc,
  type Tx,
} from '@earendil-works/pi-durable'

const agentsName = 'howaboua.agents'
const boardName = 'howaboua.board'

const BoardSelectionCutover = defineDoc<{ enabled: boolean }>({
  kind: 'howcode.board-selection-cutover',
  version: 1,
  scope: 'session',
  initial: () => ({ enabled: false }),
})

// Follow the same as-of boundary as pi.agent. Forking a pre-cutover entry needs
// migration; forking a later deliberate Agents-only selection must preserve it.
export const BoardSelectionMigration = defineDoc<{ completed: boolean }>({
  kind: 'howcode.board-selection-migration',
  version: 1,
  scope: 'conversation',
  history: 'rewindable',
  fork: 'asOf',
  initial: () => ({ completed: false }),
  checkpointWhen: () => true,
})

export async function enableBoardSelectionMigration(tx: Tx) {
  const cutover = await tx.doc(BoardSelectionCutover)
  cutover.enabled = true
}

function includeBundledBoard(names: string[] | undefined) {
  if (names?.includes(agentsName) && !names.includes(boardName)) names.push(boardName)
}

function migrateBundledSelection(agent: AgentState) {
  const selection = agent.extensions
  if (Array.isArray(selection)) {
    includeBundledBoard(selection)
    return
  }
  if (!selection) return
  // An explicit standalone Board decision wins over the old bundled default.
  if (selection.add?.includes(boardName) || selection.remove?.includes(boardName)) return
  includeBundledBoard(selection.add)
  includeBundledBoard(selection.remove)
}

export async function migrateBoardSelection(tx: Tx, conversationId: ConversationRecord['id']) {
  if (!(await tx.doc(BoardSelectionCutover)).enabled) return
  const marker = await tx.doc(BoardSelectionMigration, conversationId)
  if (marker.completed) return
  const agent = await tx.doc(AgentDoc, conversationId)
  migrateBundledSelection(agent)
  marker.completed = true
}

/** Runs in native creation, including task-owned workers and non-UI forks. */
export async function reconcileCreatedBoardSelection(tx: Tx, record: ConversationRecord) {
  if (!(await tx.doc(BoardSelectionCutover)).enabled) return
  if (record.parent) await migrateBoardSelection(tx, record.id)
  else {
    // New native conversations already inherit the post-cutover agent contract.
    const marker = await tx.doc(BoardSelectionMigration, record.id)
    marker.completed = true
  }
}
