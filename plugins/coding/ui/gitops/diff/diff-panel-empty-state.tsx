import { diffPanelEmptyStateClass } from '../../../../../src/app/ui/classes'

type DiffPanelEmptyStateProps = {
  message: string
}

export function DiffPanelEmptyState({ message }: DiffPanelEmptyStateProps) {
  return <div className={diffPanelEmptyStateClass}>{message}</div>
}
