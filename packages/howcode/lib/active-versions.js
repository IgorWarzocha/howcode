const fsp = require('node:fs/promises')
const path = require('node:path')

const ACTIVE_DIRECTORY = 'active-versions'
const STALE_LEASE_MS = 30 * 60_000

async function inspectLease(leaseDirectory, leaseName) {
  const leaseFile = path.join(leaseDirectory, leaseName)
  try {
    const active = Date.now() - (await fsp.stat(leaseFile)).mtimeMs <= STALE_LEASE_MS
    if (!active) await fsp.rm(leaseFile, { force: true })
    return active
  } catch {
    return false
  }
}

async function inspectVersionLeases(activeRoot, versionsRoot, versionName, activeVersionDirs) {
  const leaseDirectory = path.join(activeRoot, versionName)
  let leases
  try {
    leases = await fsp.readdir(leaseDirectory, { withFileTypes: true })
  } catch {
    return
  }
  const statuses = await Promise.all(
    leases.flatMap((lease) => (lease.isFile() ? [inspectLease(leaseDirectory, lease.name)] : [])),
  )
  if (statuses.includes(true)) activeVersionDirs.add(path.join(versionsRoot, versionName))
}

async function getActiveVersionDirs(cacheRoot, versionsRoot) {
  const activeRoot = path.join(cacheRoot, ACTIVE_DIRECTORY)
  let versionLeases
  try {
    versionLeases = await fsp.readdir(activeRoot, { withFileTypes: true })
  } catch {
    return new Set()
  }
  const activeVersionDirs = new Set()
  await Promise.all(
    versionLeases.flatMap((versionLease) =>
      versionLease.isDirectory()
        ? [inspectVersionLeases(activeRoot, versionsRoot, versionLease.name, activeVersionDirs)]
        : [],
    ),
  )
  return activeVersionDirs
}

module.exports = { getActiveVersionDirs }
