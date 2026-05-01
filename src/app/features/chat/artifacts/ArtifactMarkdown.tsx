import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertCodeBlock,
  InsertTable,
  ListsToggle,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../../utils/cn";

export function createMarkdownEditorPlugins(fullscreen: boolean, diffMarkdown: string) {
  return [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    tablePlugin(),
    thematicBreakPlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
    codeMirrorPlugin({
      codeBlockLanguages: {
        css: "CSS",
        html: "HTML",
        js: "JavaScript",
        jsx: "JavaScript JSX",
        json: "JSON",
        markdown: "Markdown",
        md: "Markdown",
        text: "Text",
        ts: "TypeScript",
        tsx: "TypeScript JSX",
      },
    }),
    diffSourcePlugin({ viewMode: "rich-text", diffMarkdown }),
    markdownShortcutPlugin(),
    toolbarPlugin({
      toolbarClassName: cn(
        "artifact-mdx-toolbar",
        fullscreen ? "artifact-mdx-toolbar-fullscreen" : "artifact-mdx-toolbar-drawer",
      ),
      toolbarContents: () => (
        <DiffSourceToggleWrapper options={["rich-text", "source", "diff"]}>
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
  ];
}

export function HistoricalMarkdownPreview({ content }: { content: string }) {
  return (
    <div className="h-full min-h-0 overflow-auto bg-[color:var(--sidebar)] px-7 py-6 text-[14px] leading-[1.7] text-[color:var(--text)] [text-wrap:pretty] [&_h1]:[text-wrap:balance] [&_h2]:[text-wrap:balance] [&_h3]:[text-wrap:balance] [&_pre]:[text-wrap:initial]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 text-[20px] font-semibold text-[color:var(--text)]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2 text-[17px] font-semibold text-[color:var(--text)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-[15px] font-semibold text-[color:var(--text)]">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="my-2 text-[color:var(--text)]/92">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-1 text-[color:var(--text)]/92">{children}</li>,
          a: ({ children, href }) => (
            <a
              className="text-[color:var(--accent)] underline underline-offset-2"
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noreferrer" : undefined}
              onClick={(event) => {
                if (!href?.startsWith("http://") && !href?.startsWith("https://")) return;
                event.preventDefault();
                void window.piDesktop?.openExternal?.(href);
              }}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-[rgba(185,191,243,0.32)] pl-4 text-[color:var(--muted)]">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="font-mono text-[color:var(--accent)]">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-auto rounded-lg border border-[color:var(--border)] p-3 font-mono text-[12px] leading-5 text-[color:var(--text)]">
              {children}
            </pre>
          ),
          hr: () => <hr className="my-5 border-0 border-t border-[color:var(--border)]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
