import type { ReactNode } from "react";
import { toolbarButtonClass } from "../../ui/classes";

type ToolbarButtonProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  trailing?: boolean;
};

export function ToolbarButton({ label, icon, onClick, trailing }: ToolbarButtonProps) {
  return (
    <button type="button" className={toolbarButtonClass} onClick={onClick} aria-label={label}>
      {!trailing ? icon : null}
      <span>{label}</span>
      {trailing ? icon : null}
    </button>
  );
}
