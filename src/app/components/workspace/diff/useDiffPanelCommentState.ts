import type { SelectedLineRange } from "@pierre/diffs";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type DiffCommentMetadata, buildDraftTarget } from "./diff-panel-content.helpers";
import {
  type DiffCommentDraft,
  type SavedDiffComment,
  diffCommentStore,
  getDiffCommentContextId,
} from "./diffCommentStore";

export function useDiffPanelCommentState({
  projectId,
}: {
  projectId: string;
}) {
  const [savedComments, setSavedComments] = useState<SavedDiffComment[]>([]);
  const [draftComment, setDraftComment] = useState<DiffCommentDraft | null>(null);

  const diffCommentContextId = useMemo(
    () =>
      getDiffCommentContextId({
        projectId,
      }),
    [projectId],
  );

  useEffect(() => {
    if (!diffCommentContextId) {
      setSavedComments([]);
      setDraftComment(null);
      return;
    }

    const persistedContext = diffCommentStore.getContext(diffCommentContextId);
    setSavedComments(persistedContext?.comments ?? []);
    setDraftComment(persistedContext?.draft ?? null);
  }, [diffCommentContextId]);

  useEffect(() => {
    if (!diffCommentContextId) {
      return;
    }

    diffCommentStore.setContext(diffCommentContextId, {
      comments: savedComments,
      draft: draftComment,
    });
  }, [diffCommentContextId, draftComment, savedComments]);

  const draftTarget = useMemo(() => {
    if (!draftComment) {
      return null;
    }

    return buildDraftTarget({
      fileKey: draftComment.fileKey,
      filePath: draftComment.filePath,
      side: draftComment.side,
      lineNumber: draftComment.lineNumber,
      endSide: draftComment.endSide,
      endLineNumber: draftComment.endLineNumber,
    });
  }, [draftComment]);

  const draftSelectedLines = useMemo<SelectedLineRange | null>(() => {
    if (!draftTarget) {
      return null;
    }

    return {
      start: draftTarget.lineNumber,
      end: draftTarget.endLineNumber ?? draftTarget.lineNumber,
      side: draftTarget.side,
      endSide: draftTarget.endSide ?? draftTarget.side,
    };
  }, [draftTarget]);

  const commentAnnotationsByFile = useMemo(() => {
    const next = new Map<string, DiffLineAnnotation<DiffCommentMetadata>[]>();

    for (const comment of savedComments) {
      const entries = next.get(comment.fileKey) ?? [];
      entries.push({
        side: comment.side,
        lineNumber: comment.lineNumber,
        metadata: {
          id: comment.id,
          body: comment.body,
          kind: "comment",
          side: comment.side,
          lineNumber: comment.lineNumber,
          endSide: comment.endSide,
          endLineNumber: comment.endLineNumber,
        },
      });
      next.set(comment.fileKey, entries);
    }

    if (draftTarget) {
      const entries = next.get(draftTarget.fileKey) ?? [];
      entries.push({
        side: draftTarget.side,
        lineNumber: draftTarget.lineNumber,
        metadata: {
          id: `draft:${draftTarget.fileKey}:${draftTarget.side}:${draftTarget.lineNumber}`,
          body: "",
          kind: "draft",
          side: draftTarget.side,
          lineNumber: draftTarget.lineNumber,
          endSide: draftTarget.endSide,
          endLineNumber: draftTarget.endLineNumber,
        },
      });
      next.set(draftTarget.fileKey, entries);
    }

    return next;
  }, [draftTarget, savedComments]);

  const annotationCountByFile = useMemo(() => {
    const next = new Map<string, number>();

    for (const [fileKey, annotations] of commentAnnotationsByFile) {
      next.set(fileKey, annotations.length);
    }

    return next;
  }, [commentAnnotationsByFile]);

  const persistDraftComment = useCallback(() => {
    const nextBody = draftComment?.body.trim() ?? "";
    if (!draftComment || nextBody.length === 0) {
      return;
    }

    setSavedComments((current) => [
      ...current,
      {
        ...draftComment,
        id: `${draftComment.fileKey}:${draftComment.side}:${draftComment.lineNumber}:${Date.now()}`,
        body: nextBody,
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraftComment(null);
  }, [draftComment]);

  const removeComment = useCallback((commentId: string) => {
    setSavedComments((current) => current.filter((comment) => comment.id !== commentId));
  }, []);

  return {
    annotationCountByFile,
    commentAnnotationsByFile,
    draftComment,
    draftSelectedLines,
    draftTarget,
    hasCommentContext: diffCommentContextId !== null,
    persistDraftComment,
    removeComment,
    savedComments,
    setDraftComment,
  };
}
