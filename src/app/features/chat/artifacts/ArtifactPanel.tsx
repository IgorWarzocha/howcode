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
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Artifact, ArtifactVersion } from "../../../desktop/types";
import {
  compileReactArtifactQuery,
  listArtifactsQuery,
  listArtifactVersionsQuery,
  updateArtifactQuery,
} from "../../../query/desktop-query";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";

type ArtifactPanelProps = {
  conversationId: string | null;
  visible: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
};

type ArtifactView = "list" | "code" | "preview";

function formatArtifactSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function escapeScriptContent(script: string) {
  return script.replace(/<\/script/gi, "<\\/script");
}

function getArtifactExtension(kind: Artifact["kind"]) {
  if (kind === "react") return "tsx";
  if (kind === "markdown") return "md";
  return "html";
}

const artifactScrollbarCss = `
<style>
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  *::-webkit-scrollbar-thumb { border: 1px solid transparent; border-radius: 999px; background: rgba(140, 148, 181, 0.22); background-clip: padding-box; }
  * { scrollbar-color: rgba(140, 148, 181, 0.22) transparent; }
</style>`;

const artifactDarkPreviewCss = `
    html { background: #262936; }
    body { background: #262936; color: #d5daed; }
    a { color: #b9bff3; }
    code, pre { color: #d5daed; background: rgba(255,255,255,0.04); }
    blockquote { color: #969db7; border-left: 3px solid rgba(185,191,243,0.32); margin-left: 0; padding-left: 1rem; }
    hr { border: 0; border-top: 1px solid rgba(169,178,215,0.14); }
`;

function buildHtmlPreview(content: string) {
  const capture = `${artifactScrollbarCss}
<script>
window.addEventListener('error', function(event) {
  parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: event.message, stack: event.error && event.error.stack }, '*');
});
window.addEventListener('unhandledrejection', function(event) {
  parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: String(event.reason && event.reason.message || event.reason), stack: event.reason && event.reason.stack }, '*');
});
const originalError = console.error;
console.error = function(...args) {
  parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: args.map(String).join(' ') }, '*');
  originalError.apply(console, args);
};
</script>`;
  return content.includes("<head")
    ? content.replace(/<head([^>]*)>/i, `<head$1>${capture}`)
    : `${capture}${content}`;
}

function buildReactPreview(compiledJs: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${artifactScrollbarCss}
  <style>
    html, body, #root { min-height: 100%; margin: 0; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    ${artifactDarkPreviewCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.addEventListener('error', function(event) {
      parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: event.message, stack: event.error && event.error.stack }, '*');
    });
    window.addEventListener('unhandledrejection', function(event) {
      parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: String(event.reason && event.reason.message || event.reason), stack: event.reason && event.reason.stack }, '*');
    });
    const originalError = console.error;
    console.error = function(...args) {
      parent.postMessage({ source: 'howcode-artifact-preview', phase: 'runtime', message: args.map(String).join(' ') }, '*');
      originalError.apply(console, args);
    };
  </script>
  <script type="module">${escapeScriptContent(compiledJs)}</script>
</body>
</html>`;
}

export function ArtifactPanel({
  conversationId,
  visible,
  fullscreen,
  onToggleFullscreen,
  onClose,
}: ArtifactPanelProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [view, setView] = useState<ArtifactView>("preview");
  const [draft, setDraft] = useState("");
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | "latest">("latest");
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const previousSelectedArtifactSlugRef = useRef<string | null>(null);

  const selectedArtifact = useMemo(
    () =>
      artifacts.find((artifact) => artifact.slug === selectedArtifactId) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactId],
  );
  const selectedHistoricalVersion =
    selectedVersion === "latest"
      ? null
      : (versions.find((version) => version.version === selectedVersion) ?? null);
  const selectedArtifactSlug = selectedArtifact?.slug ?? null;
  const selectedArtifactVersion = selectedArtifact?.version ?? null;
  const displayedContent = selectedHistoricalVersion?.content ?? selectedArtifact?.content ?? "";
  const showingHistoricalVersion = Boolean(selectedHistoricalVersion);
  const markdownPreviewEditable =
    view === "preview" && selectedArtifact?.kind === "markdown" && !showingHistoricalVersion;
  const saveVisible = view === "code" || markdownPreviewEditable;

  useEffect(() => {
    let cancelled = false;
    setArtifacts([]);
    setSelectedArtifactId(null);
    setSelectedVersion("latest");
    setVersions([]);
    if (!conversationId) {
      return;
    }
    void listArtifactsQuery(conversationId).then((nextArtifacts) => {
      if (cancelled) return;
      setArtifacts(nextArtifacts);
      setSelectedArtifactId((current) =>
        current && nextArtifacts.some((artifact) => artifact.slug === current)
          ? current
          : (nextArtifacts[0]?.slug ?? null),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!window.piDesktop?.subscribe) return;
    return window.piDesktop.subscribe((event) => {
      if (event.type !== "artifact-update") return;
      if (!conversationId || event.conversationId !== conversationId) return;
      setArtifacts((current) => {
        const index = current.findIndex((artifact) => artifact.slug === event.artifact.slug);
        if (index === -1) return [event.artifact, ...current];
        const next = [...current];
        next[index] = event.artifact;
        return next;
      });
      setSelectedArtifactId(event.artifact.slug);
      setSelectedVersion("latest");
      setView("preview");
      setPreviewRevision((revision) => revision + 1);
    });
  }, [conversationId]);

  useEffect(() => {
    if (previousSelectedArtifactSlugRef.current === selectedArtifactSlug) return;
    previousSelectedArtifactSlugRef.current = selectedArtifactSlug;
    setSelectedVersion("latest");
  }, [selectedArtifactSlug]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedArtifactSlug) {
      setVersions([]);
      return;
    }
    void selectedArtifactVersion;
    void listArtifactVersionsQuery(selectedArtifactSlug).then((nextVersions) => {
      if (!cancelled) setVersions(nextVersions);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedArtifactSlug, selectedArtifactVersion]);

  useEffect(() => {
    setDraft(displayedContent);
  }, [displayedContent]);

  useEffect(() => {
    let cancelled = false;
    setPreviewError(null);
    if (!selectedArtifact) {
      setPreviewHtml("");
      return;
    }
    if (selectedArtifact.kind === "markdown") return;
    if (selectedArtifact.kind === "html") {
      setPreviewHtml(buildHtmlPreview(displayedContent));
      return;
    }
    void compileReactArtifactQuery(displayedContent).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setPreviewHtml(buildReactPreview(result.js));
        setPreviewError(result.warnings.join("\n") || null);
      } else {
        setPreviewHtml("");
        setPreviewError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedArtifact, displayedContent]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source !== "howcode-artifact-preview") return;
      setPreviewError(
        [event.data.phase, event.data.message, event.data.stack].filter(Boolean).join("\n"),
      );
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const saveDraft = async () => {
    if (!selectedArtifact || showingHistoricalVersion || draft === selectedArtifact.content) return;
    setSaving(true);
    try {
      const updated = await updateArtifactQuery(selectedArtifact.slug, draft, conversationId);
      if (updated) {
        setArtifacts((current) =>
          current.map((artifact) => (artifact.slug === updated.slug ? updated : artifact)),
        );
        setSelectedVersion("latest");
        setView("preview");
        setPreviewRevision((revision) => revision + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const restoreSelectedVersion = async () => {
    if (!selectedArtifact || !selectedHistoricalVersion) return;
    setSaving(true);
    try {
      const updated = await updateArtifactQuery(
        selectedArtifact.slug,
        selectedHistoricalVersion.content,
        conversationId,
      );
      if (updated) {
        setArtifacts((current) =>
          current.map((artifact) => (artifact.slug === updated.slug ? updated : artifact)),
        );
        setSelectedVersion("latest");
        setView("preview");
        setPreviewRevision((revision) => revision + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  const downloadArtifact = () => {
    if (!selectedArtifact) return;
    const content = showingHistoricalVersion ? displayedContent : draft;
    void window.piDesktop?.saveTextToDownloads?.(
      `${selectedArtifact.slug}.${getArtifactExtension(selectedArtifact.kind)}`,
      content,
    );
  };

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
          {(["list", "code", "preview"] as const).map((nextView) => (
            <button
              key={nextView}
              type="button"
              className={cn(
                compactIconButtonClass,
                "h-7 w-7",
                view === nextView && "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)]",
              )}
              onClick={() => setView(nextView)}
              aria-label={`Show artifact ${nextView}`}
              data-tooltip={
                nextView === "list" ? "Artifact list" : nextView === "code" ? "Code" : "Preview"
              }
            >
              {nextView === "list" ? (
                <List size={14} />
              ) : nextView === "code" ? (
                <FileCode2 size={14} />
              ) : (
                <Play size={14} />
              )}
            </button>
          ))}
          {saveVisible ? (
            <button
              type="button"
              className={cn(compactIconButtonClass, "h-7 w-7")}
              onClick={() => void saveDraft()}
              disabled={
                !selectedArtifact ||
                showingHistoricalVersion ||
                draft === selectedArtifact.content ||
                saving
              }
              aria-label="Save artifact"
              data-tooltip="Save artifact"
            >
              <Save size={14} />
            </button>
          ) : null}
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
          {showingHistoricalVersion ? (
            <button
              type="button"
              className="h-7 rounded-md border border-[rgba(169,178,215,0.08)] px-2 text-[11px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] disabled:opacity-40"
              onClick={() => void restoreSelectedVersion()}
              disabled={saving}
            >
              Restore
            </button>
          ) : null}
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

        {view === "preview" &&
        selectedArtifact?.kind === "markdown" &&
        !showingHistoricalVersion ? (
          <textarea
            className="h-full w-full resize-none overflow-auto bg-[color:var(--sidebar)] px-7 py-6 text-[14px] leading-[1.7] text-[color:var(--text)] outline-none [text-wrap:pretty] placeholder:text-[color:var(--muted)] focus:ring-1 focus:ring-[color:var(--border-strong)]"
            value={draft}
            spellCheck={true}
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : null}

        {view === "preview" && selectedArtifact?.kind === "markdown" && showingHistoricalVersion ? (
          <div className="h-full min-h-0 overflow-auto bg-[color:var(--sidebar)] px-7 py-6 text-[14px] leading-[1.7] text-[color:var(--text)] [text-wrap:pretty] [&_h1]:[text-wrap:balance] [&_h2]:[text-wrap:balance] [&_h3]:[text-wrap:balance] [&_pre]:[text-wrap:initial]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-3 text-[20px] font-semibold text-[color:var(--text)]">
                    {children}
                  </h1>
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
                li: ({ children }) => (
                  <li className="my-1 text-[color:var(--text)]/92">{children}</li>
                ),
                a: ({ children, href }) => (
                  <a
                    className="text-[color:var(--accent)] underline underline-offset-2"
                    href={href}
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
              {displayedContent}
            </ReactMarkdown>
          </div>
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
