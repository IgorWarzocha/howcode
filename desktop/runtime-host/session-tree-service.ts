import { buildSessionTreeListFromPiTree, type SessionTreeList } from '../../shared/session-tree.ts'
import { getPiModule } from '../pi-module.ts'

export async function loadSessionTreeList(request: {
  sessionPath: string
}): Promise<SessionTreeList> {
  const { SessionManager } = await getPiModule()
  const manager = SessionManager.open(request.sessionPath)
  const tree = manager.getTree() as Parameters<typeof buildSessionTreeListFromPiTree>[0]
  const leafId = manager.getLeafId()
  return buildSessionTreeListFromPiTree(tree, leafId)
}
