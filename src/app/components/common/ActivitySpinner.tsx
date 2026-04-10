import { cn } from "../../utils/cn";

type ActivitySpinnerProps = {
  className?: string;
};

export function ActivitySpinner({ className }: ActivitySpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0 text-[color:var(--text)]", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="activity-spinner__rotor" fill="currentColor">
        <circle cx="12" cy="2.5" r="1.5" opacity=".14" />
        <circle cx="16.75" cy="3.77" r="1.5" opacity=".29" />
        <circle cx="20.23" cy="7.25" r="1.5" opacity=".43" />
        <circle cx="21.5" cy="12" r="1.5" opacity=".57" />
        <circle cx="20.23" cy="16.75" r="1.5" opacity=".71" />
        <circle cx="16.75" cy="20.23" r="1.5" opacity=".86" />
        <circle cx="12" cy="21.5" r="1.5" />
      </g>
    </svg>
  );
}
