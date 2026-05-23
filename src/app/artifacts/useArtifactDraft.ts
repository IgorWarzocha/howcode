import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'

export function useArtifactDraft(input: {
  displayedContent: string
  draftDirtyRef: RefObject<boolean>
  setDraft: Dispatch<SetStateAction<string>>
}) {
  const { displayedContent, draftDirtyRef, setDraft } = input
  useEffect(() => {
    if (draftDirtyRef.current) return
    setDraft(displayedContent)
  }, [displayedContent, draftDirtyRef, setDraft])
}
