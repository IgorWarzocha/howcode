import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { Check, X } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { type DiffCommentMetadata, describeCommentTarget } from "./diff-panel-content.helpers";
import type { DiffCommentDraft } from "./diffCommentStore";

const commentCardClass =
  "mx-3 mb-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--workspace)] px-3 py-2";

type DiffCommentAnnotationCardProps = {
  annotation: DiffLineAnnotation<DiffCommentMetadata>;
  draftCardRef: RefObject<HTMLDivElement | null>;
  draftComment: DiffCommentDraft | null;
  setDraftComment: Dispatch<SetStateAction<DiffCommentDraft | null>>;
  onPersistDraftComment: () => void;
  onRemoveComment: (commentId: string) => void;
};

export function DiffCommentAnnotationCard({
  annotation,
  draftCardRef,
  draftComment,
  setDraftComment,
  onPersistDraftComment,
  onRemoveComment,
}: DiffCommentAnnotationCardProps) {
  const metadata = annotation.metadata;

  if (metadata.kind === "draft") {
    return (
      <div ref={draftCardRef} className={commentCardClass}>
        <div className="mb-2 text-[11px] font-medium text-[color:var(--muted)]">
          Add comment · {draftComment ? describeCommentTarget(draftComment) : "Line comment"}
        </div>
        <textarea
          className="min-h-20 w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--workspace)] px-3 py-2 text-[12px] leading-5 text-[color:var(--text)] outline-none placeholder:text-[color:var(--muted)]"
          value={draftComment?.body ?? ""}
          onChange={(event) => {
            setDraftComment((current) =>
              current
                ? {
                    ...current,
                    body: event.target.value,
                  }
                : current,
            );
          }}
          placeholder="Leave a note on this diff"
          aria-label={`Comment for line ${annotation.lineNumber}`}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
            onClick={() => {
              setDraftComment(null);
            }}
            aria-label="Cancel comment"
            data-tooltip="Cancel comment"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--accent)] text-[#1a1c26] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onPersistDraftComment}
            disabled={(draftComment?.body.trim().length ?? 0) === 0}
            aria-label="Save comment"
            data-tooltip="Save comment"
          >
            <Check size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-saved-diff-comment-id={metadata.id} className={commentCardClass}>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-[color:var(--muted)]">
        <span>Comment · {describeCommentTarget(metadata)}</span>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[color:var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[color:var(--text)]"
          onClick={() => onRemoveComment(metadata.id)}
          aria-label="Remove comment"
          data-tooltip="Remove comment"
        >
          <X size={12} />
        </button>
      </div>
      <p className="m-0 whitespace-pre-wrap text-[12px] leading-5 text-[color:var(--text)]">
        {metadata.body}
      </p>
    </div>
  );
}
