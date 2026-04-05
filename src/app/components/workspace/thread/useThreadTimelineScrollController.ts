import type { Virtualizer } from "@tanstack/react-virtual";
import { useThreadTimelineScrollEffects } from "./useThreadTimelineScrollEffects";
import { useThreadTimelineScrollHelpers } from "./useThreadTimelineScrollHelpers";
import { useThreadTimelineScrollInteractions } from "./useThreadTimelineScrollInteractions";
import { useThreadTimelineScrollState } from "./useThreadTimelineScrollState";

export function useThreadTimelineScrollController({
  bottomSentinelRef,
  composerLayoutVersion,
  containerRef,
  effectiveCollapsedRowIds,
  onLoadEarlierMessages,
  rowStructureSignature,
  rowVirtualizer,
  rowsLength,
  setCollapsedRowIds,
  setExpandedDiffTrees,
  setExpandedToolGroupIds,
  streamingToolGroupId,
  streamingTurnRowId,
  timelineRootRef,
  virtualMeasureSignature,
  bottomAnchorKey,
}: {
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>;
  composerLayoutVersion: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  effectiveCollapsedRowIds: Record<string, boolean>;
  onLoadEarlierMessages: () => void;
  rowStructureSignature: string;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  rowsLength: number;
  setCollapsedRowIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedDiffTrees: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setExpandedToolGroupIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  streamingToolGroupId: string | null;
  streamingTurnRowId: string | null;
  timelineRootRef: React.RefObject<HTMLDivElement | null>;
  virtualMeasureSignature: string;
  bottomAnchorKey: string;
}) {
  const state = useThreadTimelineScrollState();
  const helpers = useThreadTimelineScrollHelpers({
    bottomSentinelRef,
    containerRef,
    state,
  });

  useThreadTimelineScrollEffects({
    bottomAnchorKey,
    bottomSentinelRef,
    composerLayoutVersion,
    containerRef,
    helpers,
    rowStructureSignature,
    rowVirtualizer,
    rowsLength,
    state,
    timelineRootRef,
    virtualMeasureSignature,
  });

  return useThreadTimelineScrollInteractions({
    containerRef,
    effectiveCollapsedRowIds,
    helpers,
    onLoadEarlierMessages,
    setCollapsedRowIds,
    setExpandedDiffTrees,
    setExpandedToolGroupIds,
    state,
    streamingToolGroupId,
    streamingTurnRowId,
  });
}
