import { WORKSPACE_CONTENT_MAX_WIDTH_CLASS } from "../../../ui/layout";

export const CHAT_STICKY_BOTTOM_THRESHOLD_PX = 24;
export const CHAT_ROW_GAP_PX = 16;
export const CHAT_TOP_PADDING_PX = 16;
export const CHAT_BOTTOM_PADDING_PX = 32;
export const CHAT_HISTORY_DIVIDER_HEIGHT_PX = 40;
export const CHAT_COLLAPSED_ROW_HEIGHT_PX = 56;
export const CHAT_DIFF_TREE_INDENT_BASE_PX = 8;
export const CHAT_DIFF_TREE_INDENT_STEP_PX = 16;

export const chatViewportClass = `mx-auto flex h-full w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS} overflow-visible`;
export const chatHiddenViewportClass = `mx-auto flex h-full w-full ${WORKSPACE_CONTENT_MAX_WIDTH_CLASS} overflow-hidden`;
export const chatScrollableAreaClass =
  "min-h-0 w-full overflow-y-scroll overflow-x-visible [scrollbar-gutter:stable]";
export const chatEmptyStateClass =
  "min-h-0 w-full overflow-y-scroll overflow-x-hidden px-4 pt-8 text-[color:var(--muted)] [scrollbar-gutter:stable]";
export const chatTimelinePaddingClass = "px-4 pt-4 pb-8";
export const chatStreamingTimelineClass = "grid min-w-0 gap-4 px-4 pt-4 pb-8 [&>*]:min-w-0";
export const chatRowShellClass =
  "grid w-full min-w-0 grid-cols-[24px_minmax(0,1fr)_24px] items-start gap-0 overflow-visible";
