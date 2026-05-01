import { MDXEditor, type MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import {
  Download,
  FileCode2,
  List,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Play,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";
import { createMarkdownEditorPlugins, HistoricalMarkdownPreview } from "./ArtifactMarkdown";
import { formatArtifactSlug } from "./artifactFormat";
import { useArtifactPanelState } from "./useArtifactPanelState";

type ArtifactPanelProps = {
  conversationId: string | null;
  visible: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
};

export function ArtifactPanel({
  conversationId,
  visible,
  fullscreen,
  onToggleFullscreen,
  onClose,
}: ArtifactPanelProps) {
  const markdownEditorRef = useRef<MDXEditorMethods>(null);
  const panel = useArtifactPanelState(conversationId);
  const {
    artifacts,
    selectedArtifact,
    selectedVersion,
    versions,
    view,
    draft,
    displayedContent,
    showingHistoricalVersion,
    markdownPreviewEditable,
    previewHtml,
    previewError,
    previewRevision,
    saveDisabled,
    saveDraft,
    downloadArtifact,
    setDraft,
    setPreviewError,
    setPreviewSource,
    setSelectedArtifactId,
    setSelectedVersion,
    setView,
  } = panel;
  const markdownEditorPlugins = useMemo(
    () => createMarkdownEditorPlugins(fullscreen, selectedArtifact?.content ?? ""),
    [fullscreen, selectedArtifact?.content],
  );

  useEffect(() => {
    if (view !== "preview" || selectedArtifact?.kind !== "markdown") return;
    if (markdownEditorRef.current?.getMarkdown() === displayedContent) return;
    markdownEditorRef.current?.setMarkdown(displayedContent);
  }, [displayedContent, selectedArtifact?.kind, view]);

  if (!visible || !conversationId) return null;

  return (
    <section
      aria-label="Artifacts drawer"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-l border-[rgba(169,178,215,0.08)] bg-[color:var(--workspace)]"
    >
      <div className="flex h-11 items-center justify-between gap-3 border-b border-[rgba(169,178,215,0.08)] px-3">
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-[color:var(--text)]">
          <FileCode2 size={15} className="shrink-0 text-[color:var(--muted)]" />
          {selectedArtifact ? (
            <span className="truncate font-medium">
              {formatArtifactSlug(selectedArtifact.slug)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {selectedArtifact ? (
            <select
              className="h-7 rounded-md border border-[rgba(169,178,215,0.08)] bg-[rgba(255,255,255,0.03)] px-2 text-[11px] text-[color:var(--muted)] outline-none transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[color:var(--text)]"
              value={selectedVersion}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedVersion(value === "latest" ? "latest" : Number(value));
              }}
              aria-label="Artifact version"
            >
              <option value="latest">Latest v{selectedArtifact.version}</option>
              {versions
                .filter((version) => version.version !== selectedArtifact.version)
                .map((version) => (
                  <option key={version.version} value={version.version}>
                    v{version.version}
                  </option>
                ))}
            </select>
          ) : null}
          <button
            type="button"
            className={cn(
              compactIconButtonClass,
              "h-7 w-7",
              view === "list" && "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)]",
            )}
            onClick={() => setView("list")}
            aria-label="Show artifact list"
            data-tooltip="Artifact list"
          >
            <List size={14} />
          </button>
          {selectedArtifact?.kind !== "markdown" ? (
            <button
              type="button"
              className={cn(
                compactIconButtonClass,
                "h-7 w-7",
                view !== "list" && "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)]",
              )}
              onClick={() => setView(view === "code" ? "preview" : "code")}
              disabled={!selectedArtifact}
              aria-label={view === "code" ? "Show artifact preview" : "Show artifact code"}
              data-tooltip={view === "code" ? "Preview" : "Code"}
            >
              {view === "code" ? <Play size={14} /> : <FileCode2 size={14} />}
            </button>
          ) : null}
          <button
            type="button"
            className={cn(compactIconButtonClass, "h-7 w-7")}
            onClick={() => void saveDraft()}
            disabled={saveDisabled}
            aria-label="Save artifact"
            data-tooltip={
              showingHistoricalVersion
                ? `Save snapshot as latest v${(selectedArtifact?.version ?? 0) + 1}`
                : "Save artifact"
            }
          >
            <Save size={14} />
          </button>
          <button
            type="button"
            className={cn(compactIconButtonClass, "h-7 w-7")}
            onClick={downloadArtifact}
            disabled={!selectedArtifact}
            aria-label="Download artifact"
            data-tooltip="Download"
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            className={cn(
              compactIconButtonClass,
              "h-7 w-7",
              fullscreen && "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)]",
            )}
            aria-label={fullscreen ? "Exit artifact fullscreen" : "Artifact fullscreen"}
            onClick={onToggleFullscreen}
            data-tooltip={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
            aria-label="Hide artifacts"
            onClick={onClose}
            data-tooltip="Hide artifacts"
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[color:var(--sidebar)]">
        {artifacts.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center text-[12px] text-[color:var(--muted)]">
            No artifacts yet.
          </div>
        ) : null}

        {view === "list" ? (
          <div className="h-full overflow-y-auto p-2">
            <div className="grid gap-1">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.slug}
                  type="button"
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-left text-[12px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
                    artifact.slug === selectedArtifact?.slug &&
                      "bg-[rgba(183,186,245,0.1)] text-[color:var(--text)]",
                  )}
                  onClick={() => {
                    setSelectedArtifactId(artifact.slug);
                    setView("preview");
                  }}
                >
                  <div className="truncate font-medium">{formatArtifactSlug(artifact.slug)}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted-2)]">
                    {artifact.kind} · v{artifact.version}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {view === "code" ? (
          <textarea
            className="h-full w-full resize-none overflow-auto bg-[#111521] p-3 font-mono text-[12px] leading-5 text-[color:var(--text)] outline-none"
            value={draft}
            spellCheck={false}
            readOnly={showingHistoricalVersion}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : null}

        {markdownPreviewEditable ? (
          <div className="artifact-markdown-editor h-full min-h-0 overflow-hidden bg-[color:var(--sidebar)]">
            <MDXEditor
              key={`${selectedArtifact?.slug}:${selectedArtifact?.version}`}
              ref={markdownEditorRef}
              markdown={draft}
              plugins={markdownEditorPlugins}
              spellCheck={true}
              className="h-full min-h-0"
              contentEditableClassName="artifact-markdown-editor-content"
              onChange={(markdown, initialMarkdownNormalize) => {
                if (!initialMarkdownNormalize) setDraft(markdown);
              }}
              onError={({ error }) => setPreviewError(error)}
            />
          </div>
        ) : null}

        {view === "preview" && selectedArtifact?.kind === "markdown" && showingHistoricalVersion ? (
          <HistoricalMarkdownPreview content={displayedContent} />
        ) : null}

        {view === "preview" && selectedArtifact?.kind !== "markdown" ? (
          <div className="relative h-full bg-[color:var(--sidebar)]">
            {previewError ? (
              <pre className="absolute right-2 bottom-2 left-2 z-10 max-h-32 overflow-auto rounded-lg border border-[#f2a7a7]/30 bg-[#2b1720]/95 p-2 text-[11px] whitespace-pre-wrap text-[#ffd1d1]">
                {previewError}
              </pre>
            ) : null}
            {previewHtml ? (
              <iframe
                ref={(node) => setPreviewSource(node?.contentWindow ?? null)}
                key={`${selectedArtifact?.slug}:${selectedArtifact?.version}:${selectedArtifact?.updatedAt}:${previewRevision}`}
                sandbox="allow-scripts allow-forms allow-modals"
                srcDoc={previewHtml}
                className="h-full w-full border-0"
                title={
                  selectedArtifact ? formatArtifactSlug(selectedArtifact.slug) : "Artifact preview"
                }
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
