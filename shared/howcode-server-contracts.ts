export const HOWCODE_SERVER_DESCRIPTOR_PATH = '/.well-known/howcode/server'
export const HOWCODE_SERVER_REQUEST_PREFIX = '/api/app/request/'
export const HOWCODE_SERVER_EVENTS_PREFIX = '/api/app/events/'

export type HowcodeServerCapability =
  | 'app-events'
  | 'app-transport'
  | 'projects'
  | 'git'
  | 'artifacts'
  | 'terminals'
  | 'settings'
  | 'pi-runtime-delegation'

export type HowcodeServerAuthDescriptor = {
  required: boolean
  methods: 'bearer-token'[]
}

export type HowcodeServerDescriptor = {
  name: 'howcode-server'
  protocolVersion: 1
  auth: HowcodeServerAuthDescriptor
  capabilities: HowcodeServerCapability[]
  delegatedCapabilities: HowcodeServerCapability[]
}

export const howcodeServerDescriptor: HowcodeServerDescriptor = {
  name: 'howcode-server',
  protocolVersion: 1,
  auth: {
    required: true,
    methods: ['bearer-token'],
  },
  capabilities: ['app-transport', 'app-events'],
  delegatedCapabilities: ['pi-runtime-delegation'],
}
