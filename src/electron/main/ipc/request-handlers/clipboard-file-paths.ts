import type { DesktopClipboardFilePaths } from "../../../../../shared/desktop-contracts";

type ClipFilepathsModule = {
  readClipboardFilePaths: () => {
    filePaths?: string[];
    text?: string;
  };
};

let cachedModulePromise: Promise<ClipFilepathsModule | null> | null = null;

async function loadClipFilepathsModule() {
  if (!cachedModulePromise) {
    cachedModulePromise = import("clip-filepaths")
      .then((module) => module as unknown as ClipFilepathsModule)
      .catch(() => null);
  }

  return cachedModulePromise;
}

export async function readNativeClipboardFilePaths(): Promise<DesktopClipboardFilePaths> {
  const clipFilepaths = await loadClipFilepathsModule();
  if (!clipFilepaths) {
    return { filePaths: [], text: null };
  }

  try {
    const result = clipFilepaths.readClipboardFilePaths();
    return {
      filePaths: Array.isArray(result.filePaths)
        ? result.filePaths.filter((filePath): filePath is string => typeof filePath === "string")
        : [],
      text: typeof result.text === "string" && result.text.length > 0 ? result.text : null,
    };
  } catch {
    return { filePaths: [], text: null };
  }
}
