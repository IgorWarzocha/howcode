import { useEffect } from 'react'
import { hasFilePayloadInClipboardData } from './composer-paste-attachments'

export function useGlobalComposerFileDrop(
  handleDrop: (dataTransfer: DataTransfer | null) => Promise<unknown> | unknown,
) {
  useEffect(() => {
    const handleGlobalFileDrag = (event: DragEvent) => {
      if (!hasFilePayloadInClipboardData(event.dataTransfer)) return

      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleGlobalDrop = (event: DragEvent) => {
      if (!hasFilePayloadInClipboardData(event.dataTransfer)) return

      event.preventDefault()
      void handleDrop(event.dataTransfer)
    }

    window.addEventListener('dragenter', handleGlobalFileDrag, true)
    window.addEventListener('dragover', handleGlobalFileDrag, true)
    window.addEventListener('drop', handleGlobalDrop, true)

    return () => {
      window.removeEventListener('dragenter', handleGlobalFileDrag, true)
      window.removeEventListener('dragover', handleGlobalFileDrag, true)
      window.removeEventListener('drop', handleGlobalDrop, true)
    }
  }, [handleDrop])
}
