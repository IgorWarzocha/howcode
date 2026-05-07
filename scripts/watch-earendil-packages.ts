const packages = [
  '@earendil-works/pi-agent-core',
  '@earendil-works/pi-ai',
  '@earendil-works/pi-coding-agent',
  '@earendil-works/pi-tui',
]

const defaultIntervalMinutes = 15
const timestampMillisecondsSuffixPattern = /\.\d{3}Z$/u

function getIntervalMs() {
  const rawValue = process.env['EARENDIL_PACKAGE_CHECK_INTERVAL_MINUTES']
  const intervalMinutes = rawValue ? Number(rawValue) : defaultIntervalMinutes
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    throw new Error(
      `EARENDIL_PACKAGE_CHECK_INTERVAL_MINUTES must be a positive number, got ${rawValue}`,
    )
  }
  return intervalMinutes * 60 * 1000
}

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace('T', ' ').replace(timestampMillisecondsSuffixPattern, ' UTC')
}

async function getPublishedVersion(packageName: string) {
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
  const response = await fetch(registryUrl, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`npm registry returned ${response.status} for ${packageName}`)
  }

  const metadata = (await response.json()) as {
    'dist-tags'?: { latest?: unknown } | undefined
  }
  const latest = metadata['dist-tags']?.latest
  return typeof latest === 'string' ? latest : 'published'
}

async function checkPackages() {
  const results = await Promise.all(
    packages.map(async (packageName) => ({
      packageName,
      version: await getPublishedVersion(packageName),
    })),
  )

  console.log(`\n${formatTimestamp()}`)
  for (const result of results) {
    console.log(
      result.version
        ? `✅ ${result.packageName}@${result.version}`
        : `⏳ ${result.packageName} not published yet`,
    )
  }

  return results.every((result) => result.version)
}

const intervalMs = getIntervalMs()

while (true) {
  try {
    const allPublished = await checkPackages()
    if (allPublished) {
      console.log('\nAll @earendil-works Pi packages are published.')
      process.exit(0)
    }
  } catch (error) {
    console.error(`\n${formatTimestamp()}`)
    console.error(error instanceof Error ? error.message : String(error))
  }

  console.log(`Checking again in ${intervalMs / 60 / 1000} minutes...`)
  await Bun.sleep(intervalMs)
}
