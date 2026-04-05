import { Check, ChevronDown, Folder, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PiLogoMark } from "../components/common/PiLogoMark";
import { SurfacePanel } from "../components/common/SurfacePanel";
import { TextButton } from "../components/common/TextButton";
import type { DesktopAction } from "../desktop/actions";
import type { DesktopActionResult } from "../desktop/types";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useDismissibleLayer } from "../hooks/useDismissibleLayer";
import type { Project } from "../types";
import { menuOptionClass, popoverPanelClass, settingsInputClass } from "../ui/classes";
import { cn } from "../utils/cn";

type LandingViewProps = {
  projectName: string;
  projects: Project[];
  selectedProjectId: string;
  shellCwd?: string | null;
  className?: string;
  onAction: (
    action: DesktopAction,
    payload?: Record<string, unknown>,
  ) => Promise<DesktopActionResult | null>;
  onSelectProject: (projectId: string) => void;
};

export function LandingView({
  projectName,
  projects,
  selectedProjectId,
  shellCwd,
  className,
  onAction,
  onSelectProject,
}: LandingViewProps) {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const projectButtonRef = useRef<HTMLButtonElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);
  const projectMenuPresent = useAnimatedPresence(projectMenuOpen);
  const latestProject = projects[0] ?? null;
  const visibleProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(projectQuery.trim().toLowerCase()),
  );
  const projectMenuTop = (projectButtonRef.current?.getBoundingClientRect().bottom ?? 0) + 10;

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
          {latestProject?.name ?? "No recent project"}
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
              style={{ top: projectMenuTop }}
              className={cn(
                "motion-popover fixed left-1/2 z-20 grid h-[378px] w-[min(800px,calc(100vw-32px))] grid-rows-[44px_minmax(0,1fr)] overflow-hidden rounded-[20px] p-0 text-left shadow-[0_18px_40px_rgba(0,0,0,0.28)] -translate-x-1/2",
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
