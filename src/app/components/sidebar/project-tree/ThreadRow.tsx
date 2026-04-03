import { Archive, Pin } from "lucide-react";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";

type ThreadRowProps = {
  age: string;
  isSelected: boolean;
  title: string;
  onArchive: () => void;
  onOpen: () => void;
  onPin: () => void;
};

export function ThreadRow({ age, isSelected, title, onArchive, onOpen, onPin }: ThreadRowProps) {
  return (
    <div
      className={cn(
        "group grid min-h-8 w-full grid-cols-[16px_minmax(0,1fr)_24px] items-center gap-2 rounded-xl px-2 py-0.5 text-[12.5px] leading-5 text-[color:var(--muted)] transition-colors duration-150 ease-out hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)] focus-within:bg-[rgba(255,255,255,0.04)] focus-within:text-[color:var(--text)]",
        isSelected &&
          "bg-[rgba(183,186,245,0.12)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_rgba(183,186,245,0.04)]",
      )}
    >
      <button
        type="button"
        className={cn(
          compactIconButtonClass,
          "h-4 w-4 shrink-0 border-transparent bg-transparent opacity-0 hover:bg-transparent group-hover:opacity-100 group-focus-within:opacity-100",
          isSelected && "opacity-100",
        )}
        onClick={onPin}
        aria-label="Pin thread"
      >
        <Pin size={12} />
      </button>

      <button
        type="button"
        className="flex min-w-0 items-center py-1 text-left"
        onClick={onOpen}
        aria-current={isSelected ? "page" : undefined}
      >
        <span className="truncate">{title}</span>
      </button>

      <span className="relative inline-flex h-4 w-6 shrink-0 items-center justify-center text-[color:var(--muted-2)]">
        <span
          className={cn(
            "absolute transition-opacity duration-150 ease-out group-hover:opacity-0 group-focus-within:opacity-0",
            isSelected && "opacity-0",
          )}
          aria-hidden="true"
        >
          {age}
        </span>
        <button
          type="button"
          className={cn(
            compactIconButtonClass,
            "absolute h-4 w-4 border-transparent bg-transparent opacity-0 hover:bg-transparent group-hover:opacity-100 group-focus-within:opacity-100",
            isSelected && "opacity-100",
          )}
          onClick={onArchive}
          aria-label="Archive thread"
        >
          <Archive size={12} />
        </button>
      </span>
    </div>
  );
}
