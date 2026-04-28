export type DesktopClipboardSnapshot = {
  formats: string[];
  valuesByFormat: Record<string, string>;
};

export type DesktopClipboardFilePaths = {
  filePaths: string[];
  text: string | null;
};

export type DesktopClipboardImage = {
  path: string;
  mimeType: string;
} | null;
