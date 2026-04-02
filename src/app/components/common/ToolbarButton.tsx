import type { ReactNode } from "react";
import { toolbarButtonClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type ToolbarButtonProps = {
  label: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  trailing?: boolean;
  className?: string;
};

export function ToolbarButton({ label, icon, onClick, trailing, className }: ToolbarButtonProps) {
  return (
    <button type="button" className={cn(toolbarButtonClass, className)} onClick={onClick}>
      {!trailing ? icon : null}
      <span>{label}</span>
      {trailing ? icon : null}
    </button>
  );
}
