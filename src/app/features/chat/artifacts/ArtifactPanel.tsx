import { FileCode2, List, Maximize2, Minimize2, PanelRightClose, Play, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Artifact } from "../../../desktop/types";
import {
  compileReactArtifactQuery,
  listArtifactsQuery,
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

function escapeScriptContent(script: string) {
  return script.replace(/<\/script/gi, "<\\/script");
}

const artifactScrollbarCss = `
<style>
  *::-webkit-scrollbar { width: 8px; height: 8px; }
  *::-webkit-scrollbar-thumb { border: 1px solid transparent; border-radius: 999px; background: rgba(140, 148, 181, 0.22); background-clip: padding-box; }
  * { scrollbar-color: rgba(140, 148, 181, 0.22) transparent; }
</style>`;

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
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fff; color: #111827; }
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
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);

  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactId],
  );

  useEffect(() => {
    let cancelled = false;
    if (!conversationId) {
      setArtifacts([]);
      setSelectedArtifactId(null);
      return;
    }
    void listArtifactsQuery(conversationId).then((nextArtifacts) => {
      if (cancelled) return;
      setArtifacts(nextArtifacts);
      setSelectedArtifactId((current) =>
        current && nextArtifacts.some((artifact) => artifact.id === current)
          ? current
          : (nextArtifacts[0]?.id ?? null),
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
      if (conversationId && event.conversationId !== conversationId) return;
      setArtifacts((current) => {
        const index = current.findIndex((artifact) => artifact.id === event.artifact.id);
        if (index === -1) return [event.artifact, ...current];
        const next = [...current];
        next[index] = event.artifact;
        return next;
      });
      setSelectedArtifactId(event.artifact.id);
      setView("preview");
      setPreviewRevision((revision) => revision + 1);
    });
  }, [conversationId]);

  useEffect(() => {
    setDraft(selectedArtifact?.content ?? "");
  }, [selectedArtifact?.id, selectedArtifact?.content]);

  useEffect(() => {
    let cancelled = false;
    setPreviewError(null);
    if (!selectedArtifact) {
      setPreviewHtml("");
      return;
    }
    if (selectedArtifact.kind === "html") {
      setPreviewHtml(buildHtmlPreview(selectedArtifact.content));
      return;
    }
    void compileReactArtifactQuery(selectedArtifact.content).then((result) => {
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
  }, [selectedArtifact]);

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
    if (!selectedArtifact || draft === selectedArtifact.content) return;
    setSaving(true);
    try {
      const updated = await updateArtifactQuery(selectedArtifact.id, draft);
      if (updated) {
        setArtifacts((current) =>
          current.map((artifact) => (artifact.id === updated.id ? updated : artifact)),
        );
        setView("preview");
        setPreviewRevision((revision) => revision + 1);
      }
    } finally {
      setSaving(false);
    }
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
          <span className="truncate font-medium">Artifacts</span>
          {selectedArtifact ? (
            <span className="truncate text-[11px] text-[color:var(--muted)]">
              {selectedArtifact.title} · {selectedArtifact.kind} v{selectedArtifact.version}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
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
              data-tooltip={nextView === "list" ? "Artifact list" : nextView === "code" ? "Code" : "Preview"}
            >
              {nextView === "list" ? <List size={14} /> : nextView === "code" ? <FileCode2 size={14} /> : <Play size={14} />}
            </button>
          ))}
          {view === "code" ? (
            <button
              type="button"
              className={cn(compactIconButtonClass, "h-7 w-7")}
              onClick={() => void saveDraft()}
              disabled={!selectedArtifact || draft === selectedArtifact.content || saving}
              aria-label="Save artifact"
              data-tooltip="Save artifact"
            >
              <Save size={14} />
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
                  key={artifact.id}
                  type="button"
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-left text-[12px] text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]",
                    artifact.id === selectedArtifact?.id &&
                      "bg-[rgba(183,186,245,0.1)] text-[color:var(--text)]",
                  )}
                  onClick={() => {
                    setSelectedArtifactId(artifact.id);
                    setView("preview");
                  }}
                >
                  <div className="truncate font-medium">{artifact.title}</div>
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
            onChange={(event) => setDraft(event.target.value)}
          />
        ) : null}

        {view === "preview" ? (
          <div className="relative h-full bg-white">
            {previewError ? (
              <pre className="absolute right-2 bottom-2 left-2 z-10 max-h-32 overflow-auto rounded-lg border border-[#f2a7a7]/30 bg-[#2b1720]/95 p-2 text-[11px] whitespace-pre-wrap text-[#ffd1d1]">
                {previewError}
              </pre>
            ) : null}
            {previewHtml ? (
              <iframe
                key={`${selectedArtifact?.id}:${selectedArtifact?.version}:${selectedArtifact?.updatedAt}:${previewRevision}`}
                sandbox="allow-scripts allow-forms allow-modals"
                srcDoc={previewHtml}
                className="h-full w-full border-0"
                title={selectedArtifact?.title ?? "Artifact preview"}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
