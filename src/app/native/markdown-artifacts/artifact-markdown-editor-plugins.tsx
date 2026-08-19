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
import { cn } from '../../utils/cn'

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
          </span>
          <span className="artifact-mdx-toolbar-row artifact-mdx-toolbar-row-tertiary">
            <InsertTable />
            <InsertCodeBlock />
          </span>
        </DiffSourceToggleWrapper>
      ),
    }),
  ]
}
