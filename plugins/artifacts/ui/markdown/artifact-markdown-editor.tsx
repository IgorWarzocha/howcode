import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'

import { useEffect, useMemo, useRef } from 'react'
import { createMarkdownEditorPlugins } from './artifact-markdown-editor-plugins'

type ArtifactMarkdownEditorProps = {
  content: string
  diffMarkdown: string
  fullscreen: boolean
  artifactKey: string
  onChange: (markdown: string) => void
  onError: (error: string) => void
}

export function ArtifactMarkdownEditor({
  artifactKey,
  content,
  diffMarkdown,
  fullscreen,
  onChange,
  onError,
}: ArtifactMarkdownEditorProps) {
  const markdownEditorRef = useRef<MDXEditorMethods>(null)
  const markdownEditorPlugins = useMemo(
    () => createMarkdownEditorPlugins(fullscreen, diffMarkdown),
    [fullscreen, diffMarkdown],
  )

  useEffect(() => {
    if (markdownEditorRef.current?.getMarkdown() === content) return
    markdownEditorRef.current?.setMarkdown(content)
  }, [content])

  return (
    <div className="artifact-markdown-editor h-full min-h-0 overflow-hidden bg-[color:var(--workspace)]">
      <MDXEditor
        key={artifactKey}
        ref={markdownEditorRef}
        markdown={content}
        plugins={markdownEditorPlugins}
        spellCheck={true}
        className="h-full min-h-0"
        contentEditableClassName="artifact-markdown-editor-content"
        onChange={(markdown, initialMarkdownNormalize) => {
          if (!initialMarkdownNormalize) onChange(markdown)
        }}
        onError={({ error }) => onError(error)}
      />
    </div>
  )
}
