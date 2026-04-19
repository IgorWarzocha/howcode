import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ComposerAttachment, ComposerFilePickerState } from "../../../desktop/types";
import { mergeComposerAttachments } from "../../../../../shared/composer-attachments";

type UseComposerAttachmentPickerProps = {
  openMenu: "model" | "picker" | null;
  pickerRootPath: string;
  pickerSessionKey: string | null;
  setAttachments: Dispatch<SetStateAction<ComposerAttachment[]>>;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  setOpenMenu: Dispatch<SetStateAction<"model" | "picker" | null>>;
  onListAttachmentEntries: (request: {
    projectId?: string | null;
    path?: string | null;
    rootPath?: string | null;
  }) => Promise<ComposerFilePickerState | null>;
};

export function useComposerAttachmentPicker({
  openMenu,
  pickerRootPath,
  pickerSessionKey,
  setAttachments,
  setErrorMessage,
  setOpenMenu,
  onListAttachmentEntries,
}: UseComposerAttachmentPickerProps) {
  const [pickerState, setPickerState] = useState<ComposerFilePickerState | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const pickerRequestIdRef = useRef(0);
  const previousOpenMenuRef = useRef<"model" | "picker" | null>(openMenu);
  const previousPickerScopeKeyRef = useRef<string | null>(null);

  const fetchPickerEntries = useCallback(
    async (path?: string | null, rootPath?: string | null) => {
      return await onListAttachmentEntries({
        projectId: pickerRootPath,
        path: path ?? null,
        rootPath: rootPath ?? pickerState?.rootPath ?? pickerRootPath ?? null,
      });
    },
    [onListAttachmentEntries, pickerRootPath, pickerState?.rootPath],
  );

  const loadPickerEntries = useCallback(
    async (path?: string | null, rootPath?: string | null) => {
      const requestId = pickerRequestIdRef.current + 1;
      pickerRequestIdRef.current = requestId;
      setPickerLoading(true);

      try {
        const nextPickerState = await fetchPickerEntries(path, rootPath);
        if (requestId !== pickerRequestIdRef.current) {
          return nextPickerState;
        }

        setPickerState(nextPickerState);
        setErrorMessage(null);
        return nextPickerState;
      } catch (error) {
        if (requestId !== pickerRequestIdRef.current) {
          return null;
        }

        setErrorMessage(error instanceof Error ? error.message : "Could not load files.");
        return null;
      } finally {
        if (requestId === pickerRequestIdRef.current) {
          setPickerLoading(false);
        }
      }
    },
    [fetchPickerEntries, setErrorMessage],
  );

  const pickAttachments = async () => {
    if (openMenu === "picker") {
      setOpenMenu(null);
      return;
    }

    setOpenMenu("picker");
  };

  useEffect(() => {
    const scopeKey = `${pickerSessionKey ?? ""}::${pickerRootPath}`;
    const pickerOpened = openMenu === "picker" && previousOpenMenuRef.current !== "picker";
    const pickerScopeChanged =
      openMenu === "picker" && previousPickerScopeKeyRef.current !== scopeKey;

    previousOpenMenuRef.current = openMenu;
    previousPickerScopeKeyRef.current = scopeKey;

    if (!pickerOpened && !pickerScopeChanged) {
      return;
    }

    void loadPickerEntries(pickerRootPath, pickerRootPath);
  }, [loadPickerEntries, openMenu, pickerRootPath, pickerSessionKey]);

  const openPickerDirectory = async (path: string) => {
    await loadPickerEntries(path);
  };

  const openPickerRoot = async (rootPath: string) => {
    await loadPickerEntries(rootPath, rootPath);
  };

  const togglePendingPickerAttachment = (attachment: ComposerAttachment) => {
    setAttachments((current) => {
      const exists = current.some(
        (currentAttachment) => currentAttachment.path === attachment.path,
      );

      return exists
        ? current.filter((currentAttachment) => currentAttachment.path !== attachment.path)
        : [...current, attachment];
    });
    setErrorMessage(null);
  };

  const attachPickerAttachments = (
    nextAttachments: ComposerAttachment[],
    options?: { closeMenu?: boolean },
  ) => {
    if (nextAttachments.length === 0) {
      return;
    }

    const attachedPaths = new Set(nextAttachments.map((attachment) => attachment.path));

    setAttachments((current) => mergeComposerAttachments(current, nextAttachments));

    if (options?.closeMenu) {
      setOpenMenu(null);
    }

    setErrorMessage(null);
  };

  const removeAttachment = (attachmentPath: string) => {
    setAttachments((current) =>
      current.filter((currentAttachment) => currentAttachment.path !== attachmentPath),
    );
  };

  const clearAttachments = () => {
    setAttachments([]);
    setErrorMessage(null);
  };

  return {
    attachPickerAttachments,
    clearAttachments,
    openPickerDirectory,
    openPickerRoot,
    pickAttachments,
    pickerLoading,
    pickerState,
    removeAttachment,
    togglePendingPickerAttachment,
  };
}
