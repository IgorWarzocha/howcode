import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { mkdir, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ACTIVE_DIRECTORY = 'active-versions'
const HEARTBEAT_MS = 10_000
const STALE_LEASE_MS = 30 * 60_000

function getLeaseDirectory(cacheRoot: string, versionDir: string) {
  return path.join(cacheRoot, ACTIVE_DIRECTORY, path.basename(versionDir))
}

export async function startRunningVersionLease(cacheRoot: string, versionDir: string | null) {
  if (!versionDir) return () => undefined
  const leaseDirectory = getLeaseDirectory(cacheRoot, versionDir)
  const leaseFile = path.join(leaseDirectory, `${process.pid}-${randomUUID()}.lease`)
  await mkdir(leaseDirectory, { recursive: true })
  await writeFile(leaseFile, new Date().toISOString())

  const heartbeat = setInterval(() => {
    const now = new Date()
    void utimes(leaseFile, now, now).catch(() => undefined)
  }, HEARTBEAT_MS)
  heartbeat.unref()

  return () => {
    clearInterval(heartbeat)
    try {
      rmSync(leaseFile, { force: true })
    } catch {
      // Lease expiry remains a safe fallback after an abrupt filesystem failure.
    }
  }
}

export async function getActiveVersionDirs(cacheRoot: string, versionsRoot: string) {
  const activeRoot = path.join(cacheRoot, ACTIVE_DIRECTORY)
  let versionLeases: Array<{ isDirectory(): boolean; name: string }>
  try {
    versionLeases = await readdir(activeRoot, { withFileTypes: true })
  } catch {
    return new Set<string>()
  }

  const activeVersionDirs = new Set<string>()
  await Promise.all(
    versionLeases.flatMap((versionLease) =>
      versionLease.isDirectory()
        ? [inspectVersionLeases(activeRoot, versionsRoot, versionLease.name, activeVersionDirs)]
        : [],
    ),
  )
  return activeVersionDirs
}

async function inspectVersionLeases(
  activeRoot: string,
  versionsRoot: string,
  versionName: string,
  activeVersionDirs: Set<string>,
) {
  const leaseDirectory = path.join(activeRoot, versionName)
  let leases: Array<{ isFile(): boolean; name: string }>
  try {
    leases = await readdir(leaseDirectory, { withFileTypes: true })
  } catch {
    return
  }
  await Promise.all(
    leases.flatMap((lease) =>
      lease.isFile() ? [inspectLease(leaseDirectory, lease.name, versionName, versionsRoot)] : [],
    ),
  ).then((statuses) => {
    if (statuses.includes(true)) activeVersionDirs.add(path.join(versionsRoot, versionName))
  })
}

async function inspectLease(
  leaseDirectory: string,
  leaseName: string,
  versionName: string,
  versionsRoot: string,
) {
  const leaseFile = path.join(leaseDirectory, leaseName)
  try {
    const active = Date.now() - (await stat(leaseFile)).mtimeMs <= STALE_LEASE_MS
    if (!active) await rm(leaseFile, { force: true })
    return active && path.dirname(path.join(versionsRoot, versionName)) === versionsRoot
  } catch {
    return false
  }
}
