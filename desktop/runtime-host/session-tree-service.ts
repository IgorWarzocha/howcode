import { buildSessionTreeListFromPiTree, type SessionTreeList } from '../../shared/session-tree.ts'
import { getPiModule } from '../pi-module.ts'
import { getCachedRuntimeForSessionPath } from './live-runtime-registry.ts'

export async function loadSessionTreeList(request: {
  sessionPath: string
}): Promise<SessionTreeList> {
  const { SessionManager } = await getPiModule()
  const manager = SessionManager.open(request.sessionPath)
  const tree = manager.getTree() as Parameters<typeof buildSessionTreeListFromPiTree>[0]
  let leafId = manager.getLeafId()

  // Pi keeps leafId in memory only; reopening the JSONL sets leafId to the last file entry,
  // not the active branch after navigateTree / branch(). Use the live session when open.
  const cachedRuntimePromise = getCachedRuntimeForSessionPath(request.sessionPath)
  if (cachedRuntimePromise) {
    const runtime = await cachedRuntimePromise
    leafId = runtime.session.sessionManager.getLeafId()
  }

  return buildSessionTreeListFromPiTree(tree, leafId)
}
