import type { AnnotationSide, FileDiffMetadata } from "@pierre/diffs/react";

export type RenderablePatch =
  | {
      kind: "files";
      files: FileDiffMetadata[];
    }
  | {
      kind: "raw";
      text: string;
      reason: string;
    };

export type DiffCommentMetadata = {
  id: string;
  body: string;
  kind: "comment" | "draft";
  side: AnnotationSide;
  lineNumber: number;
  endSide?: AnnotationSide;
  endLineNumber?: number;
};
