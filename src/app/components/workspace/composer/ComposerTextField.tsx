import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { cn } from "../../../utils/cn";

type ComposerTextFieldProps = {
  value: string;
  placeholder: string;
  placeholderTone?: "muted" | "error";
  statusMessage?: string | null;
  ariaLabel: string;
  ariaActiveDescendant?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
  reservedLineCount?: number;
  onHeightChange?: (height: number) => void;
  onChange: (value: string) => void;
  onInput?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
};

export function ComposerTextField({
  value,
  placeholder,
  placeholderTone = "muted",
  statusMessage = null,
  ariaLabel,
  ariaActiveDescendant,
  ariaControls,
  ariaExpanded,
  reservedLineCount = 4,
  onHeightChange,
  onChange,
  onInput,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  onExpandedChange,
}: ComposerTextFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastReportedHeightRef = useRef<number | null>(null);
  const [reservedHeight, setReservedHeight] = useState<number | null>(null);

  const focusTextareaAtEnd = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.focus();
    const cursorPosition = textarea.value.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20;
    const reservedHeight = Math.ceil(lineHeight * reservedLineCount);
    setReservedHeight((current) => (current === reservedHeight ? current : reservedHeight));

    textarea.style.height = "0px";
    const nextHeight = Math.max(textarea.scrollHeight, 24);
    textarea.style.height = `${nextHeight}px`;
    if (lastReportedHeightRef.current !== nextHeight) {
      lastReportedHeightRef.current = nextHeight;
      onHeightChange?.(nextHeight);
    }

    onExpandedChange?.(nextHeight > reservedHeight + 1);

    if (value.length === 0) {
      textarea.scrollTop = 0;
    }
  }, [onExpandedChange, onHeightChange, reservedLineCount, value]);

  return (
    <div
      className="grid min-w-0 gap-1"
      style={reservedHeight ? { minHeight: `${reservedHeight}px` } : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse") {
          return;
        }

        if (document.activeElement === textareaRef.current) {
          return;
        }

        focusTextareaAtEnd();
      }}
      onPointerDown={(event) => {
        if (event.target === textareaRef.current) {
          return;
        }

        event.preventDefault();
        focusTextareaAtEnd();
      }}
    >
      {statusMessage ? (
        <div className="truncate text-[12px] leading-4 text-[#f2a7a7]">{statusMessage}</div>
      ) : null}
      <textarea
        ref={textareaRef}
        rows={1}
        className={cn(
          "m-0 w-full min-h-6 resize-none overflow-hidden bg-transparent p-0 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none",
          placeholderTone === "error"
            ? "placeholder:text-[#f2a7a7]"
            : "placeholder:text-[color:var(--muted-2)]",
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-activedescendant={ariaActiveDescendant}
        aria-autocomplete={ariaControls ? "list" : undefined}
        aria-controls={ariaControls}
        aria-expanded={ariaExpanded}
        placeholder={placeholder}
      />
    </div>
  );
}
