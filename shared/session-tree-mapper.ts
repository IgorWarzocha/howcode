import type { SessionTreeList, SessionTreeListRow } from './session-tree.ts'

type PiSessionTreeNode = {
  entry: {
    id: string
    parentId: string | null
    type: string
    summary?: string | undefined
    customType?: string | undefined
    message?: {
      role: string
      content?: unknown
      toolName?: string | undefined
      command?: string | undefined
      stopReason?: string | undefined
    }
  }
  children: PiSessionTreeNode[]
  label?: string | undefined
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content.replace(/\s+/g, ' ').trim()
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    if ('type' in block && block.type === 'text' && 'text' in block) {
      const text = (block as { text?: unknown }).text
      if (typeof text === 'string') parts.push(text)
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function hasTextInAssistantContent(content: unknown): boolean {
  return extractTextFromContent(content).length > 0
}

function isAssistantToolOnlyEntry(
  entry: PiSessionTreeNode['entry'],
  isCurrentLeaf: boolean,
): boolean {
  if (isCurrentLeaf) return false
  if (entry.type !== 'message' || entry.message?.role !== 'assistant') return false
  const msg = entry.message
  const hasText = hasTextInAssistantContent(msg.content)
  const stopReason = msg.stopReason
  const isErrorOrAborted = Boolean(stopReason) && stopReason !== 'stop' && stopReason !== 'toolUse'
  return !(hasText || isErrorOrAborted)
}

function entryKind(entry: PiSessionTreeNode['entry']): SessionTreeListRow['kind'] {
  switch (entry.type) {
    case 'message': {
      const role = entry.message?.role
      if (role === 'user') return 'user'
      if (role === 'assistant') return 'assistant'
      if (role === 'toolResult') return 'tool'
      return 'other'
    }
    case 'branch_summary':
      return 'branch'
    case 'compaction':
      return 'summary'
    case 'custom_message':
      return 'other'
    default:
      return 'system'
  }
}

function isComposerTreeBookkeepingEntry(entry: PiSessionTreeNode['entry']): boolean {
  switch (entry.type) {
    case 'label':
    case 'model_change':
    case 'thinking_level_change':
    case 'session_info':
    case 'custom':
      return true
    default:
      return false
  }
}

function messageEntryLabel(entry: PiSessionTreeNode['entry']): string {
  const msg = entry.message
  if (!msg) return '(message)'
  if (msg.role === 'user' || msg.role === 'assistant') {
    const text = extractTextFromContent(msg.content)
    return text.slice(0, 120) || `(${msg.role})`
  }
  if (msg.role === 'toolResult') return (msg.toolName ?? 'tool').slice(0, 120)
  if (msg.role === 'bashExecution' && msg.command) return msg.command.slice(0, 120)
  return msg.role
}

function entryLabel(node: PiSessionTreeNode): string {
  if (node.label?.trim()) return node.label.trim().slice(0, 120)
  const entry = node.entry
  if (entry.type === 'message') return messageEntryLabel(entry)
  if (entry.type === 'branch_summary') {
    return (entry.summary ?? 'Branch summary').replace(/\s+/g, ' ').trim().slice(0, 120)
  }
  if (entry.type === 'compaction') {
    return (entry.summary ?? 'Compaction').replace(/\s+/g, ' ').trim().slice(0, 120)
  }
  if (entry.type === 'custom_message') return (entry.customType ?? 'custom').slice(0, 120)
  if (entry.type === 'model_change') return 'Model change'
  if (entry.type === 'thinking_level_change') return 'Reasoning level'
  if (entry.type === 'session_info') return 'Session info'
  if (entry.type === 'label') return 'Label'
  return entry.type
}

function entryMeta(entry: PiSessionTreeNode['entry']): string | undefined {
  if (entry.type === 'branch_summary') return 'branch'
  if (entry.type === 'compaction') return 'compact'
  if (entry.type === 'message' && entry.message?.role === 'toolResult') return 'tool'
  return undefined
}

function buildEntryParentById(roots: PiSessionTreeNode[]): Map<string, string | null> {
  const byId = new Map<string, string | null>()
  for (const node of collectAllNodes(roots)) {
    byId.set(node.entry.id, node.entry.parentId)
  }
  return byId
}

function buildActivePathIds(
  leafId: string | null,
  entryParentById: Map<string, string | null>,
): Set<string> {
  const path = new Set<string>()
  let current: string | null = leafId
  while (current) {
    path.add(current)
    current = entryParentById.get(current) ?? null
  }
  return path
}

function collectAllNodes(roots: PiSessionTreeNode[]): PiSessionTreeNode[] {
  const allNodes: PiSessionTreeNode[] = []
  const stack = [...roots]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) break
    allNodes.push(node)
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      const child = node.children[i]
      if (child) stack.push(child)
    }
  }
  return allNodes
}

function buildContainsActiveMap(roots: PiSessionTreeNode[], leafId: string | null) {
  const containsActive = new Map<PiSessionTreeNode, boolean>()
  const allNodes = collectAllNodes(roots)
  for (let i = allNodes.length - 1; i >= 0; i -= 1) {
    const node = allNodes[i]
    if (!node) continue
    let has = leafId !== null && node.entry.id === leafId
    for (const child of node.children) {
      if (containsActive.get(child)) has = true
    }
    containsActive.set(node, has)
  }
  return containsActive
}

function orderChildrenByActive(
  children: PiSessionTreeNode[],
  containsActive: Map<PiSessionTreeNode, boolean>,
) {
  const prioritized: PiSessionTreeNode[] = []
  const rest: PiSessionTreeNode[] = []
  for (const child of children) {
    if (containsActive.get(child)) prioritized.push(child)
    else rest.push(child)
  }
  return [...prioritized, ...rest]
}

function childIndentFor(parentIndent: number, multipleChildren: boolean, justBranched: boolean) {
  if (multipleChildren) return parentIndent + 1
  if (justBranched && parentIndent > 0) return parentIndent + 1
  return parentIndent
}

function appendVisibleTreeRow(
  rows: SessionTreeListRow[],
  node: PiSessionTreeNode,
  indent: number,
  isCurrentLeaf: boolean,
) {
  const entry = node.entry
  if (isComposerTreeBookkeepingEntry(entry)) return
  rows.push({
    id: entry.id,
    parentId: entry.parentId,
    depth: indent,
    label: entryLabel(node),
    meta: entryMeta(entry),
    kind: entryKind(entry),
    isLeaf: isCurrentLeaf,
    isOnActivePath: false,
    assistantToolOnly: isAssistantToolOnlyEntry(entry, isCurrentLeaf),
  })
}

function flattenPiTree(
  roots: PiSessionTreeNode[],
  leafId: string | null,
  multipleRoots: boolean,
): SessionTreeListRow[] {
  const rows: SessionTreeListRow[] = []
  const containsActive = buildContainsActiveMap(roots, leafId)

  type StackItem = [PiSessionTreeNode, number, boolean]
  const stack: StackItem[] = []
  const orderedRoots = [...roots].sort(
    (a, b) => Number(containsActive.get(b)) - Number(containsActive.get(a)),
  )
  for (let i = orderedRoots.length - 1; i >= 0; i -= 1) {
    const root = orderedRoots[i]
    if (root) stack.push([root, multipleRoots ? 1 : 0, multipleRoots])
  }

  while (stack.length > 0) {
    const item = stack.pop()
    if (!item) break
    const [node, indent, justBranched] = item
    appendVisibleTreeRow(rows, node, indent, node.entry.id === leafId)

    const children = node.children
    const multipleChildren = children.length > 1
    const orderedChildren = orderChildrenByActive(children, containsActive)
    const nextIndent = childIndentFor(indent, multipleChildren, justBranched)

    for (let i = orderedChildren.length - 1; i >= 0; i -= 1) {
      const child = orderedChildren[i]
      if (child) stack.push([child, nextIndent, multipleChildren])
    }
  }

  const entryParentById = buildEntryParentById(roots)
  const activePath = buildActivePathIds(leafId, entryParentById)
  for (const row of rows) {
    row.isOnActivePath = activePath.has(row.id)
    row.isLeaf = row.id === leafId
  }

  return rows
}

export function buildSessionTreeListFromPiTree(
  roots: PiSessionTreeNode[],
  leafId: string | null,
): SessionTreeList {
  const multipleRoots = roots.length > 1
  const rows = flattenPiTree(roots, leafId, multipleRoots)
  return { leafId, rows }
}
