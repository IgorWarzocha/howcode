import { getPersonInputData as readPersonInputData } from '@howaboua/howcode-sdk/people'
import { readTrustedInputData } from './input-origin'

export { personInputKind } from '@howaboua/howcode-sdk/people'

/** Historical authors stay available independently of the installed People capability. */
export function getPersonInputData(entry: { kind: string; data?: unknown }) {
  return readPersonInputData(readTrustedInputData(entry)?.inputEntry ?? entry)
}
