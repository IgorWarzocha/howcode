export type BrowserSpeechRecognitionAlternative = {
  transcript: string;
  confidence?: number;
};

export type BrowserSpeechRecognitionResult = ArrayLike<BrowserSpeechRecognitionAlternative> & {
  isFinal: boolean;
  length: number;
};

export type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
};

export type BrowserSpeechRecognitionErrorEvent = {
  error: string;
  message?: string;
};

export type BrowserSpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type BrowserSpeechRecognitionConstructor = {
  new (): BrowserSpeechRecognitionInstance;
};

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

export function getBrowserSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function appendDictatedText(current: string, dictated: string) {
  const normalized = dictated.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return current;
  }

  if (current.trim().length === 0) {
    return normalized;
  }

  return /[\s([{"'“‘-]$/.test(current) ? `${current}${normalized}` : `${current} ${normalized}`;
}

export function getBrowserSpeechRecognitionErrorMessage(error: string) {
  switch (error) {
    case "audio-capture":
      return "Could not access the microphone.";
    case "language-not-supported":
      return "This runtime does not support speech recognition for your current language.";
    case "network":
      return "Speech recognition failed because the runtime reported a network error.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone or speech recognition permission was denied.";
    case "no-speech":
      return "No speech was detected.";
    default:
      return `Dictation failed${error ? ` (${error})` : "."}`;
  }
}
