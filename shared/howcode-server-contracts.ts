export const HOWCODE_SERVER_DESCRIPTOR_PATH = '/.well-known/howcode/server'
export const HOWCODE_SERVER_PROGRAMMATIC_PROMPT_PATH = '/api/programmatic/prompt'

export const HOWCODE_SERVER_PROTOCOL_VERSION = 2
export const HOWCODE_SERVER_APP_VERSION = '0.1.63'
export const HOWCODE_SERVER_FINGERPRINT = `${HOWCODE_SERVER_APP_VERSION}:protocol-${HOWCODE_SERVER_PROTOCOL_VERSION}`

export type HowcodeServerCapability =
  | 'legacy-app-transport'
  | 'effect-rpc'
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
  protocolVersion: number
  appVersion: string
  runtimeKind: 'desktop-local' | 'standalone' | 'unknown'
  fingerprint: string
  auth: HowcodeServerAuthDescriptor
  capabilities: HowcodeServerCapability[]
  delegatedCapabilities: HowcodeServerCapability[]
}

export const howcodeServerDescriptor: HowcodeServerDescriptor = {
  name: 'howcode-server',
  protocolVersion: HOWCODE_SERVER_PROTOCOL_VERSION,
  appVersion: HOWCODE_SERVER_APP_VERSION,
  runtimeKind: 'unknown',
  fingerprint: HOWCODE_SERVER_FINGERPRINT,
  auth: {
    required: true,
    methods: ['bearer-token'],
  },
  capabilities: ['effect-rpc'],
  delegatedCapabilities: ['pi-runtime-delegation'],
}

export function assertCompatibleHowcodeServerDescriptor(descriptor: HowcodeServerDescriptor) {
  if (descriptor.name !== 'howcode-server') {
    throw new Error('Remote endpoint is not a Howcode server.')
  }
  if (descriptor.protocolVersion !== HOWCODE_SERVER_PROTOCOL_VERSION) {
    throw new Error(
      `Incompatible Howcode server protocol ${descriptor.protocolVersion}; expected ${HOWCODE_SERVER_PROTOCOL_VERSION}.`,
    )
  }
  if (!descriptor.capabilities.includes('effect-rpc')) {
    throw new Error('Howcode server is missing Effect RPC capability.')
  }
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
    serverKind?: 'managed' | 'external'
  } | null
}

export type HowcodeServerConnectionMode = 'local' | 'external' | 'disabled'
export type HowcodeServerKind = 'local' | 'direct' | 'ssh-managed' | 'ssh-external' | 'unknown'
export type HowcodeServerConnectionPhase = 'idle' | 'connecting' | 'connected' | 'disconnected'
export type HowcodeServerReconnectPhase = 'idle' | 'attempting' | 'waiting' | 'exhausted'

export type HowcodeServerConnectionState = {
  environment: HowcodeEnvironment
  environmentId: string
  environmentName: string
  mode: HowcodeServerConnectionMode
  connected: boolean
  phase: HowcodeServerConnectionPhase
  reconnectPhase: HowcodeServerReconnectPhase
  attemptCount: number
  reconnectAttemptCount: number
  connectedAt: string | null
  disconnectedAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  nextRetryAt: string | null
  baseUrl: string | null
  serverKind: HowcodeServerKind
  closeCode: number | null
  closeReason: string | null
  fingerprint: string | null
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
  instanceId?: string | null
  instanceName?: string | null
  projectCount?: number | null
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

export type HowcodeProgrammaticPromptRequest = {
  text: string
  projectId?: string | null
  sessionPath?: string | null
  chatGroupId?: string | null
}
