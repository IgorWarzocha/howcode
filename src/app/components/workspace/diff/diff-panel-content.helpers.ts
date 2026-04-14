export {
  DIFF_FILE_ESTIMATED_COMMENT_HEIGHT,
  DIFF_FILE_ESTIMATED_FILE_GAP,
  DIFF_FILE_ESTIMATED_HEADER_HEIGHT,
  DIFF_FILE_ESTIMATED_LINE_HEIGHT,
  DIFF_FILE_ESTIMATED_SEPARATOR_HEIGHT,
  DIFF_PANEL_UNSAFE_CSS,
} from "./diff-panel-content.constants";
export {
  buildDraftTarget,
  describeCommentTarget,
  isSameDraftTarget,
} from "./diff-panel-content.comments";
export {
  alignElementInScrollViewport,
  estimateFileDiffHeight,
} from "./diff-panel-content.layout";
export { resolvePointerLineTarget } from "./diff-panel-content.pointer";
export {
  buildFileDiffRenderKey,
  describeCollapsedLines,
  getFileChangeCounts,
  getFileHeaderContextLabel,
  getRenderablePatch,
  joinProjectFilePath,
  orderRenderableFiles,
  resolveFileDiffPath,
} from "./diff-panel-content.rendering";
export type { DiffCommentMetadata, RenderablePatch } from "./diff-panel-content.types";
