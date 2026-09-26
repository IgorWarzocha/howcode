import { validateReleaseAssets } from './release-assets-validation'

const releaseDirectory = process.argv[2]
if (!releaseDirectory) throw new Error('Usage: bun scripts/validate-release-assets.ts <directory>')

// biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
const expectedChannel = process.env['HOWCODE_RELEASE_CHANNEL']
// biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
const expectedVersion = process.env['HOWCODE_RELEASE_VERSION']
// biome-ignore lint/complexity/useLiteralKeys: ProcessEnv is an index-signature type.
const expectedAssetBaseUrl = process.env['HOWCODE_RELEASE_ASSET_BASE_URL']
const manifestCount = await validateReleaseAssets(
  releaseDirectory,
  expectedChannel,
  expectedVersion,
  expectedAssetBaseUrl,
)
console.log(`Validated ${manifestCount} release manifests in ${releaseDirectory}`)
