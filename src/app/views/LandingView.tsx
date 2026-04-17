import { useState } from "react";
import { MarkdownContent } from "../components/common/MarkdownContent";
import type { AppSettings, DesktopActionInvoker } from "../desktop/types";
import type { Project } from "../types";
import { cn } from "../utils/cn";
import { getLandingOverviewContent } from "./landing-overview-content";

type LandingViewProps = {
  appSettings: AppSettings;
  projectName: string;
  projects: Project[];
  selectedProjectId: string;
  className?: string;
  onAction: DesktopActionInvoker;
  onSelectProject: (projectId: string) => void;
};

function PixelHLogo() {
  const pixelRows = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [2, 3, 4, 0, 0, 0, 0, 0, 4, 3, 2],
    [2, 3, 4, 2, 3, 4, 3, 2, 4, 3, 2],
    [3, 4, 5, 3, 4, 5, 4, 3, 5, 4, 3],
    [2, 3, 4, 2, 3, 4, 3, 2, 4, 3, 2],
    [2, 3, 4, 0, 0, 0, 0, 0, 4, 3, 2],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [1, 2, 3, 0, 0, 0, 0, 0, 3, 2, 1],
    [2, 3, 4, 0, 0, 0, 0, 0, 4, 3, 2],
    [2, 3, 4, 0, 0, 0, 0, 0, 4, 3, 2],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];
  const fills = {
    1: "#727894",
    2: "#969db7",
    3: "#a9b1ea",
    4: "#b9bff3",
    5: "#d5daed",
  } as const;
  const cell = 52;
  const pixels = pixelRows.flatMap((row, rowIndex) =>
    row.flatMap((value, columnIndex) => {
      if (value === 0) {
        return [];
      }

      const x = columnIndex * cell + 114;
      const y = rowIndex * cell + 10;

      return [
        {
          key: `${x}:${y}`,
          x,
          y,
          fill: fills[value as keyof typeof fills],
        },
      ];
    }),
  );

  return (
    <svg viewBox="0 0 800 800" aria-label="Howcode logo" role="img" className="h-[120px] w-[92px]">
      {pixels.map((pixel) => (
        <rect
          key={pixel.key}
          x={pixel.x}
          y={pixel.y}
          width={cell}
          height={cell}
          rx="0"
          fill={pixel.fill}
        />
      ))}
    </svg>
  );
}

export function LandingView({ className }: LandingViewProps) {
  const content = getLandingOverviewContent();
  const [activeSection, setActiveSection] = useState<"roadmap" | "changelog">("roadmap");
  const activeContent = activeSection === "roadmap" ? content.roadmap : content.changelog;

  return (
    <section
      className={cn(
        "mx-auto flex w-full justify-center px-6 pt-[clamp(6rem,24vh,16rem)]",
        className,
      )}
    >
      <div className="grid w-full max-w-[760px] justify-items-center gap-8 text-center">
        <PixelHLogo />

        <div className="grid w-full max-w-[680px] gap-0">
          <div className="grid grid-cols-2 border-b border-[rgba(169,178,215,0.08)]">
            <button
              type="button"
              className={cn(
                "border-b px-0 py-4 text-center text-[15px] font-medium transition-colors",
                activeSection === "roadmap"
                  ? "border-[color:var(--accent)] text-[color:var(--text)]"
                  : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]",
              )}
              onClick={() => setActiveSection("roadmap")}
              aria-pressed={activeSection === "roadmap"}
            >
              {content.roadmap.title}
            </button>

            <button
              type="button"
              className={cn(
                "border-b px-0 py-4 text-center text-[15px] font-medium transition-colors",
                activeSection === "changelog"
                  ? "border-[color:var(--accent)] text-[color:var(--text)]"
                  : "border-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]",
              )}
              onClick={() => setActiveSection("changelog")}
              aria-pressed={activeSection === "changelog"}
            >
              {content.changelog.title}
            </button>
          </div>

          <div className="pt-4 text-left">
            <MarkdownContent markdown={activeContent.markdown} className="gap-2 text-[13px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
