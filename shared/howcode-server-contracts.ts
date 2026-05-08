export const HOWCODE_SERVER_DESCRIPTOR_PATH = '/.well-known/howcode/server'
export const HOWCODE_SERVER_REQUEST_PREFIX = '/api/app/request/'
export const HOWCODE_SERVER_WS_PATH = '/api/app/ws'

export type HowcodeServerCapability =
  | 'app-transport'
  | 'app-websocket-events'
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
  capabilities: ['app-transport', 'app-websocket-events'],
  delegatedCapabilities: ['pi-runtime-delegation'],
}

export type HowcodeEnvironmentKind = 'local-desktop' | 'external-server' | 'ssh-server' | 'disabled'
export type HowcodeEnvironmentScope = 'global' | 'project'

export type HowcodeEnvironment = {
  id: string
  name: string
  kind: HowcodeEnvironmentKind
  scope: HowcodeEnvironmentScope
  serverUrl: string | null
  projectId?: string | null
  ssh?: {
    host: string
    localPort: number
    remotePort: number
  } | null
}

export type HowcodeServerConnectionMode = 'local' | 'external' | 'disabled'

export type HowcodeServerConnectionState = {
  environment: HowcodeEnvironment
  environmentId: string
  environmentName: string
  mode: HowcodeServerConnectionMode
  connected: boolean
  baseUrl: string | null
  descriptor: HowcodeServerDescriptor | null
  error: string | null
}

export type HowcodeRemoteEnvironmentKind = 'direct' | 'ssh'

export type HowcodeRemoteEnvironment = {
  id: string
  name: string
  kind: HowcodeRemoteEnvironmentKind
  serverUrl?: string | null
  sshHost?: string | null
  localPort?: number | null
  remotePort?: number | null
  remoteCommand?: string | null
  tokenRef: string
  hasToken: boolean
}

export type HowcodeRemoteEnvironmentInput = Omit<
  HowcodeRemoteEnvironment,
  'id' | 'tokenRef' | 'hasToken'
> & {
  id?: string | null
  token?: string | null
}

export type HowcodeRemoteEnvironmentTestResult = {
  ok: boolean
  error: string | null
}

export type HowcodeProjectRemoteEnvironmentAssignment = {
  projectId: string
  remoteEnvironmentId: string | null
}

export type HowcodeInstanceProjectSummary = {
  id: string
  name: string
  repoOriginUrl?: string | null
  threadCount?: number | null
  latestModifiedMs?: number | null
}

export type HowcodeInstanceManifest = {
  instanceId: string
  instanceName: string
  serverUrl: string | null
  projects: HowcodeInstanceProjectSummary[]
}
