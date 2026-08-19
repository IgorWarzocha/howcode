const packageJson = require('../package.json')

const APP_NAME = packageJson.howcode.appName
const RELEASE_BASE_URL = process.env.HOWCODE_BASE_URL || packageJson.howcode.releaseBaseUrl
const RELEASE_CHANNEL =
  process.env.HOWCODE_RELEASE_CHANNEL || packageJson.howcode.releaseChannel || 'main'
const CHANNEL_RELEASE_TAGS = { main: 'channel-main', dev: 'channel-dev' }

const TARGETS = {
  'darwin:arm64': {
    os: 'macos',
    arch: 'arm64',
    executable: `${APP_NAME}.app/Contents/MacOS/${APP_NAME}`,
  },
  'darwin:x64': {
    os: 'macos',
    arch: 'x64',
    executable: `${APP_NAME}.app/Contents/MacOS/${APP_NAME}`,
  },
  'linux:arm64': { os: 'linux', arch: 'arm64', executable: `${APP_NAME}/${APP_NAME}` },
  'linux:x64': { os: 'linux', arch: 'x64', executable: `${APP_NAME}/${APP_NAME}` },
  'win32:arm64': { os: 'win', arch: 'arm64', executable: `${APP_NAME}/${APP_NAME}.exe` },
  'win32:x64': { os: 'win', arch: 'x64', executable: `${APP_NAME}/${APP_NAME}.exe` },
}

function getTarget() {
  const target = TARGETS[`${process.platform}:${process.arch}`]
  if (!target) throw new Error(`Unsupported platform: ${process.platform} ${process.arch}`)
  return target
}

function getReleaseChannel() {
  if (RELEASE_CHANNEL === 'main' || RELEASE_CHANNEL === 'dev') return RELEASE_CHANNEL
  throw new Error(`Unsupported release channel: ${RELEASE_CHANNEL}`)
}

module.exports = {
  APP_NAME,
  CHANNEL_RELEASE_TAGS,
  RELEASE_BASE_URL,
  getReleaseChannel,
  getTarget,
}
