import { Check, ChevronDown, Folder, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PiLogoMark } from "../components/common/PiLogoMark";
import { SurfacePanel } from "../components/common/SurfacePanel";
import { TextButton } from "../components/common/TextButton";
import type { AppSettings, DesktopActionInvoker } from "../desktop/types";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../hooks/useDismissibleLayer";
import type { Project } from "../types";
import {
  menuOptionClass,
  popoverPanelClass,
  settingsInputClass,
  toolbarButtonClass,
} from "../ui/classes";
import { cn } from "../utils/cn";

type LandingViewProps = {
  appSettings: AppSettings;
  projectName: string;
  projects: Project[];
  selectedProjectId: string;
  className?: string;
  onAction: DesktopActionInvoker;
  onSelectProject: (projectId: string) => void;
};

export function LandingView({
  appSettings,
  projectName,
  projects,
  selectedProjectId,
  className,
  onAction,
  onSelectProject,
}: LandingViewProps) {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const projectButtonRef = useRef<HTMLButtonElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);
  const projectMenuPresent = useAnimatedPresence(projectMenuOpen);
  const latestProject = projects[0] ?? null;
  const visibleProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(projectQuery.trim().toLowerCase()),
  );

  const startNewThreadInProject = async (projectId: string) => {
    onSelectProject(projectId);
    await onAction("thread.new", { projectId });
    setProjectMenuOpen(false);
    setProjectQuery("");
  };

  useDismissibleLayer({
    open: projectMenuOpen,
    onDismiss: () => setProjectMenuOpen(false),
    refs: [projectButtonRef, projectMenuRef],
  });

  useEffect(() => {
    if (!projectMenuOpen) {
      return;
    }

    projectSearchInputRef.current?.focus();
  }, [projectMenuOpen]);

  const showProjectImportNotice = appSettings.projectImportState === null;
  const projectIds = projects.map((project) => project.id);

  const handleImportProjectUi = async () => {
    setImportBusy(true);
    setImportErrorMessage(null);
    setImportStatusMessage("Scanning projects for UI info…");

    try {
      const result = await onAction("projects.import.apply", { projectIds });
      const error = typeof result?.result?.error === "string" ? result.result.error : null;

      if (error) {
        setImportErrorMessage(error);
        setImportStatusMessage(null);
        return;
      }

      const checkedProjectCount =
        typeof result?.result?.checkedProjectCount === "number"
          ? result.result.checkedProjectCount
          : projectIds.length;
      const originProjectCount =
        typeof result?.result?.originProjectCount === "number"
          ? result.result.originProjectCount
          : 0;

      setImportStatusMessage(
        checkedProjectCount > 0
          ? `Scanned ${checkedProjectCount} · Found ${originProjectCount} origins`
          : "Nothing to scan",
      );
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <section
      className={cn(
        "grid w-full content-start place-items-center gap-1 pt-[33vh] text-center text-[color:var(--muted)]",
        className,
      )}
    >
      <div className="grid h-16 w-16 place-items-center rounded-full text-[color:var(--accent)]">
        <PiLogoMark className="h-[42px] w-[42px]" />
      </div>
      <h1 className="m-0 text-[clamp(36px,6vw,54px)] font-medium tracking-[-0.04em] text-[color:var(--accent)]">
        Let’s build
      </h1>

      {showProjectImportNotice ? (
        <SurfacePanel className="relative mt-3 grid w-full max-w-[460px] gap-2 rounded-3xl border-[color:var(--border-strong)] bg-[rgba(45,48,64,0.62)] p-4 pr-10 text-left">
          <button
            type="button"
            className="absolute top-3 right-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[color:var(--text)]"
            onClick={() => {
              void onAction("settings.update", {
                key: "projectImportState",
                imported: false,
              });
            }}
            aria-label="Dismiss import notice"
          >
            <X size={14} />
          </button>

          <div className="grid gap-1 pr-2">
            <div className="text-[14px] font-medium text-[color:var(--text)]">Import projects</div>
            <p className="m-0 text-[12.5px] leading-5 text-[color:var(--muted)]">
              This will scan your projects for UI information in the app. Recommended on first
              launch. Accessible later in settings menu.
            </p>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-[12px]">
            <button
              type="button"
              className={cn(
                toolbarButtonClass,
                "shrink-0 whitespace-nowrap rounded-full border border-[color:var(--border)] px-2.5 text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-45",
              )}
              onClick={() => {
                void handleImportProjectUi();
              }}
              disabled={importBusy}
            >
              {importBusy ? "Importing…" : "Import now"}
            </button>
            {importStatusMessage ? (
              <span className="truncate text-[color:var(--muted)]" title={importStatusMessage}>
                {importStatusMessage}
              </span>
            ) : null}
            {importErrorMessage ? (
              <span className="truncate text-[#f2a7a7]" title={importErrorMessage}>
                {importErrorMessage}
              </span>
            ) : null}
          </div>
        </SurfacePanel>
      ) : null}

      <div className="mt-3 grid w-full max-w-[460px] grid-cols-2 gap-1.5 max-sm:grid-cols-1">
        <TextButton
          className="inline-flex h-11 w-full min-w-0 items-center justify-center rounded-2xl border border-transparent bg-transparent px-4 text-[15px] text-[color:var(--text)] transition-colors hover:border-[color:var(--border-strong)] hover:bg-[rgba(255,255,255,0.05)] disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => {
            if (latestProject) {
              void startNewThreadInProject(latestProject.id);
            }
          }}
          disabled={!latestProject}
        >
          {latestProject?.name ?? projectName}
        </TextButton>

        <div className="relative">
          <TextButton
            ref={projectButtonRef}
            className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-transparent bg-transparent px-4 text-[15px] text-[color:var(--text)] transition-colors hover:border-[color:var(--border-strong)] hover:bg-[rgba(255,255,255,0.05)]"
            onClick={() => setProjectMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={projectMenuOpen}
            aria-controls="landing-project-menu"
          >
            Select project
            <ChevronDown size={16} />
          </TextButton>

          {projectMenuPresent ? (
            <SurfacePanel
              ref={projectMenuRef}
              id="landing-project-menu"
              role="menu"
              aria-label="Select project"
              data-open={projectMenuOpen ? "true" : "false"}
              className={cn(
                "motion-popover absolute top-[calc(100%+10px)] left-1/2 z-20 grid h-[378px] w-[min(800px,calc(100vw-32px))] grid-rows-[44px_minmax(0,1fr)] overflow-hidden rounded-[20px] p-0 text-left shadow-[0_18px_40px_rgba(0,0,0,0.28)] -translate-x-1/2",
                popoverPanelClass,
              )}
            >
              <div className="grid h-11 grid-cols-[16px_minmax(0,1fr)] items-center gap-2 border-b border-[rgba(169,178,215,0.08)] px-3 py-2">
                <Search size={14} className="text-[color:var(--muted)]" />
                <input
                  ref={projectSearchInputRef}
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder="Find project"
                  className={cn(settingsInputClass, "h-8 border-0 bg-transparent px-0 py-0")}
                  aria-label="Find project"
                />
              </div>

              <div className="relative min-h-0 overflow-y-auto p-1">
                <div className="grid grid-cols-3 gap-1 max-md:grid-cols-2 max-sm:grid-cols-1">
                  {visibleProjects.map((project) => {
                    const active = project.id === selectedProjectId;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        className={cn(
                          menuOptionClass,
                          "min-w-0 grid-cols-[16px_minmax(0,1fr)] text-[color:var(--text)]",
                          active && "bg-[rgba(255,255,255,0.06)]",
                        )}
                        onClick={() => void startNewThreadInProject(project.id)}
                        title={project.name}
                        role="menuitem"
                      >
                        <span className="inline-flex items-center justify-center text-[color:var(--muted)]">
                          {active ? <Check size={14} /> : <Folder size={14} />}
                        </span>
                        <span className="truncate">{project.name}</span>
                      </button>
                    );
                  })}
                </div>
                {visibleProjects.length === 0 ? (
                  <div className="px-2 py-8 text-center text-[12px] text-[color:var(--muted)]">
                    No matching projects.
                  </div>
                ) : null}
              </div>
            </SurfacePanel>
          ) : null}
        </div>
      </div>
    </section>
  );
}
