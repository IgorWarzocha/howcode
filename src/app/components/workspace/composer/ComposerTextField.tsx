import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useHoverToFocus } from "../../../hooks/useHoverToFocus";
import { compactIconButtonClass } from "../../../ui/classes";
import { cn } from "../../../utils/cn";

const COLLAPSED_VISIBLE_LINE_COUNT = 5;
const EXPANDED_VISIBLE_LINE_COUNT = 15;

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
  hoverToFocus?: boolean;
  hoverToBlur?: boolean;
  hoverBoundaryRef?: RefObject<HTMLElement | null>;
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
  hoverToFocus = true,
  hoverToBlur = false,
  hoverBoundaryRef,
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
  const [fieldExpanded, setFieldExpanded] = useState(false);
  const [canExpandField, setCanExpandField] = useState(false);
  const lineHeightRef = useRef(20);

  const focusTextareaAtEnd = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.focus();
    const cursorPosition = textarea.value.length;
    textarea.setSelectionRange(cursorPosition, cursorPosition);
  }, []);
  const handleHoverToFocus = useHoverToFocus({
    enabled: hoverToFocus,
    boundaryRef: hoverBoundaryRef ?? wrapperRef,
    targetRef: textareaRef,
    focus: focusTextareaAtEnd,
    blur: () => textareaRef.current?.blur(),
    blurOnLeave: hoverToBlur,
  });

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

    const maxVisibleLineCount = fieldExpanded
      ? EXPANDED_VISIBLE_LINE_COUNT
      : COLLAPSED_VISIBLE_LINE_COUNT;
    const maxVisibleHeight = Math.ceil(lineHeight * maxVisibleLineCount);

    textarea.style.height = "0px";
    const scrollHeight = Math.max(textarea.scrollHeight, 24);
    const nextHeight = Math.min(scrollHeight, Math.max(maxVisibleHeight, 24));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = scrollHeight > nextHeight + 1 ? "auto" : "hidden";

    const nextCanExpandField =
      scrollHeight > Math.ceil(lineHeight * COLLAPSED_VISIBLE_LINE_COUNT) + 1;
    setCanExpandField((current) => (current === nextCanExpandField ? current : nextCanExpandField));
    if (!nextCanExpandField && fieldExpanded) {
      setFieldExpanded(false);
    }

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
  }, [fieldExpanded, onExpandedChange, onHeightChange, reservedLineCount, value]);

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
      const canGrowForAdornment = textarea.scrollHeight <= textarea.offsetHeight + 1;
      const maxContainerHeight = textarea.offsetHeight + (canGrowForAdornment ? lineHeight : 0);
      const nextContainerHeight = Math.min(
        maxContainerHeight,
        Math.max(textarea.offsetHeight, nextTop + lineHeight),
      );

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
      onPointerEnter={handleHoverToFocus}
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
            statusTone === "success" ? "text-[color:var(--green)]" : "text-[color:var(--danger)]",
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
            "m-0 w-full min-h-6 resize-none bg-transparent p-0 text-[14px] leading-[1.45] text-[color:var(--text)] outline-none transition-opacity duration-150 [scrollbar-gutter:stable]",
            canExpandField &&
              "composer-textarea-scroll-above-button relative left-[0.25rem] w-[calc(100%-0.25rem)]",
            readOnly && "cursor-wait opacity-45",
            placeholderTone === "error"
              ? "placeholder:text-[color:var(--danger)]"
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
        {canExpandField ? (
          <div className="pointer-events-none absolute right-[-0.875rem] bottom-0 z-20 flex h-7 items-center justify-end">
            <button
              type="button"
              className={cn(
                compactIconButtonClass,
                "composer-expand-button pointer-events-auto h-7 w-7 shrink-0",
              )}
              aria-label={fieldExpanded ? "Collapse composer" : "Expand composer"}
              aria-pressed={fieldExpanded}
              data-tooltip={fieldExpanded ? "Collapse composer" : "Expand composer"}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                setFieldExpanded((current) => !current);
              }}
            >
              {fieldExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        ) : null}
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
