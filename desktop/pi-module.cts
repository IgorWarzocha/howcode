export type PiModule = typeof import("@mariozechner/pi-coding-agent");

let piModulePromise: Promise<PiModule> | undefined;

export function getPiModule() {
  if (!piModulePromise) {
    piModulePromise = import("@mariozechner/pi-coding-agent");
  }

  return piModulePromise;
}
