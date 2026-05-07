import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { useEffect, useMemo, useRef } from 'react'
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  codeBlockPlugin,
  codeMirrorPlugin,
  DiffSourceToggleWrapper,
  diffSourcePlugin,
  headingsPlugin,
  InsertCodeBlock,
  InsertTable,
  ListsToggle,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  Separator,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from '@mdxeditor/editor'
import { cn } from '../../../utils/cn'

export function createMarkdownEditorPlugins(fullscreen: boolean, diffMarkdown: string) {
  return [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    tablePlugin(),
    thematicBreakPlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: 'text' }),
    codeMirrorPlugin({
      codeBlockLanguages: {
        css: 'CSS',
        html: 'HTML',
        js: 'JavaScript',
        jsx: 'JavaScript JSX',
        json: 'JSON',
        markdown: 'Markdown',
        md: 'Markdown',
        text: 'Text',
        ts: 'TypeScript',
        tsx: 'TypeScript JSX',
      },
    }),
    diffSourcePlugin({ viewMode: 'rich-text', diffMarkdown }),
    markdownShortcutPlugin(),
    toolbarPlugin({
      toolbarClassName: cn(
        'artifact-mdx-toolbar',
        fullscreen ? 'artifact-mdx-toolbar-fullscreen' : 'artifact-mdx-toolbar-drawer',
      ),
      toolbarContents: () => (
        <DiffSourceToggleWrapper options={['rich-text', 'source', 'diff']}>
          <span className="artifact-mdx-toolbar-row artifact-mdx-toolbar-row-primary">
            <UndoRedo />
            <Separator />
            <BlockTypeSelect />
          </span>
          <span className="artifact-mdx-toolbar-row artifact-mdx-toolbar-row-secondary">
            <Separator />
            <BoldItalicUnderlineToggles />
            <CodeToggle />
            <Separator />
            <ListsToggle />
            <CreateLink />
            <InsertTable />
            <InsertCodeBlock />
          </span>
        </DiffSourceToggleWrapper>
      ),
    }),
  ]
}



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
    <div className="artifact-markdown-editor h-full min-h-0 overflow-hidden bg-[color:var(--sidebar)]">
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
