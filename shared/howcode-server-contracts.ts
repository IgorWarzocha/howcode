export const HOWCODE_SERVER_DESCRIPTOR_PATH = '/.well-known/howcode/server'
export const HOWCODE_SERVER_REQUEST_PREFIX = '/api/app/request/'

export type HowcodeServerCapability =
  | 'app-transport'
  | 'projects'
  | 'git'
  | 'artifacts'
  | 'terminals'
  | 'settings'
  | 'pi-runtime-delegation'

export type HowcodeServerDescriptor = {
  name: 'howcode-server'
  protocolVersion: 1
  capabilities: HowcodeServerCapability[]
  delegatedCapabilities: HowcodeServerCapability[]
}

export const howcodeServerDescriptor: HowcodeServerDescriptor = {
  name: 'howcode-server',
  protocolVersion: 1,
  capabilities: ['app-transport'],
  delegatedCapabilities: ['pi-runtime-delegation'],
}
