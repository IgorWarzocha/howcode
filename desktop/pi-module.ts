export type PiModule = typeof import('@earendil-works/pi-coding-agent')

let piModulePromise: Promise<PiModule> | undefined

export function getPiModule() {
  if (!piModulePromise) {
    piModulePromise = import('@earendil-works/pi-coding-agent')
  }

  return piModulePromise
}
