import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../../utils/cn";

type ComposerTextFieldProps = {
  value: string;
  placeholder: string;
  placeholderTone?: "muted" | "error";
  statusMessage?: string | null;
  statusTone?: "error" | "success";
  ariaLabel: string;
  ariaActiveDescendant?: string;
  ariaControls?: string;
  ariaExpanded?: boolean;
  reservedLineCount?: number;
  trailingAdornment?: ReactNode;
  readOnly?: boolean;
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
  statusTone = "error",
  ariaLabel,
  ariaActiveDescendant,
  ariaControls,
  ariaExpanded,
  reservedLineCount = 4,
  trailingAdornment = null,
  readOnly = false,
  onHeightChange,
  onChange,
  onInput,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  onExpandedChange,
}: ComposerTextFieldProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastReportedHeightRef = useRef<number | null>(null);
  const [reservedHeight, setReservedHeight] = useState<number | null>(null);
  const [trailingAdornmentPosition, setTrailingAdornmentPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [trailingContainerHeight, setTrailingContainerHeight] = useState<number | null>(null);
  const lineHeightRef = useRef(20);

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
    lineHeightRef.current = lineHeight;
    const reservedHeight = Math.ceil(lineHeight * reservedLineCount);
    setReservedHeight((current) => (current === reservedHeight ? current : reservedHeight));

    textarea.style.height = "0px";
    const nextHeight = Math.max(textarea.scrollHeight, 24);
    textarea.style.height = `${nextHeight}px`;
    window.requestAnimationFrame(() => {
      const reportedHeight = wrapperRef.current?.getBoundingClientRect().height ?? nextHeight;
      if (lastReportedHeightRef.current !== reportedHeight) {
        lastReportedHeightRef.current = reportedHeight;
        onHeightChange?.(reportedHeight);
      }
    });

    onExpandedChange?.(nextHeight > reservedHeight + 1);

    if (value.length === 0) {
      textarea.scrollTop = 0;
    }
  }, [onExpandedChange, onHeightChange, reservedLineCount, value]);

  useEffect(() => {
    const height = wrapperRef.current?.getBoundingClientRect().height;
    if (!height || lastReportedHeightRef.current === height) {
      return;
    }

    lastReportedHeightRef.current = height;
    onHeightChange?.(height);
  });

  useLayoutEffect(() => {
    if (!trailingAdornment) {
      setTrailingAdornmentPosition(null);
      setTrailingContainerHeight(null);
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const measureTrailingAdornmentPosition = () => {
      const computedStyle = window.getComputedStyle(textarea);
      const mirror = document.createElement("div");
      const marker = document.createElement("span");
      const lineHeight = Number.parseFloat(computedStyle.lineHeight) || lineHeightRef.current;

      mirror.style.position = "absolute";
      mirror.style.visibility = "hidden";
      mirror.style.pointerEvents = "none";
      mirror.style.whiteSpace = "pre-wrap";
      mirror.style.overflowWrap = "break-word";
      mirror.style.wordBreak = "break-word";
      mirror.style.boxSizing = computedStyle.boxSizing;
      mirror.style.width = `${textarea.clientWidth}px`;
      mirror.style.font = computedStyle.font;
      mirror.style.fontFamily = computedStyle.fontFamily;
      mirror.style.fontSize = computedStyle.fontSize;
      mirror.style.fontWeight = computedStyle.fontWeight;
      mirror.style.letterSpacing = computedStyle.letterSpacing;
      mirror.style.lineHeight = computedStyle.lineHeight;
      mirror.style.padding = computedStyle.padding;
      mirror.style.border = computedStyle.border;

      mirror.textContent = value || placeholder || "";
      marker.textContent = "\u200b";
      mirror.appendChild(marker);
      document.body.appendChild(mirror);

      const mirrorRect = mirror.getBoundingClientRect();
      const markerRect = marker.getBoundingClientRect();
      document.body.removeChild(mirror);

      const markerLeft = Math.max(0, markerRect.left - mirrorRect.left);
      const markerTop = Math.max(0, markerRect.top - mirrorRect.top);
      const adornmentWidth = 24;
      const adornmentGap = 6;
      const shouldWrapAdornment = markerLeft + adornmentGap + adornmentWidth > textarea.clientWidth;
      const nextLeft = shouldWrapAdornment ? 0 : markerLeft + adornmentGap;
      const nextTop = Math.max(0, markerTop + (shouldWrapAdornment ? lineHeight : 0) - 1.5);
      const nextContainerHeight = Math.max(textarea.scrollHeight, nextTop + lineHeight);

      setTrailingAdornmentPosition((current) =>
        current?.left === nextLeft && current.top === nextTop
          ? current
          : { left: nextLeft, top: nextTop },
      );
      setTrailingContainerHeight((current) =>
        current === nextContainerHeight ? current : nextContainerHeight,
      );
    };

    measureTrailingAdornmentPosition();
    window.addEventListener("resize", measureTrailingAdornmentPosition);
    return () => window.removeEventListener("resize", measureTrailingAdornmentPosition);
  }, [placeholder, trailingAdornment, value]);

  return (
    <div
      ref={wrapperRef}
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
        <div
          className={cn(
            "truncate text-[12px] leading-4",
            statusTone === "success" ? "text-[color:var(--green)]" : "text-[#f2a7a7]",
          )}
        >
          {statusMessage}
        </div>
      ) : null}
      <div
        className="relative min-w-0"
        style={trailingContainerHeight ? { minHeight: `${trailingContainerHeight}px` } : undefined}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          className={cn(
            "m-0 w-full min-h-6 resize-none overflow-hidden bg-transparent p-0 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none transition-opacity duration-150",
            readOnly && "cursor-wait opacity-45",
            placeholderTone === "error"
              ? "placeholder:text-[#f2a7a7]"
              : "placeholder:text-[color:var(--muted-2)]",
          )}
          value={value}
          onChange={(event) => {
            if (!readOnly) onChange(event.target.value);
          }}
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
          readOnly={readOnly}
        />
        {trailingAdornment && trailingAdornmentPosition ? (
          <span
            className="absolute z-10 inline-flex items-center"
            style={{
              left: `${trailingAdornmentPosition.left}px`,
              top: `${trailingAdornmentPosition.top}px`,
              height: `${lineHeightRef.current}px`,
            }}
          >
            {trailingAdornment}
          </span>
        ) : null}
      </div>
    </div>
  );
}
