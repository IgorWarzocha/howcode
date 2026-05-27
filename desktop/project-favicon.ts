import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const faviconMimeTypes: Record<string, string> = {
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const faviconCandidates = [
  'favicon.svg',
  'favicon.ico',
  'favicon.png',
  'favicon.webp',
  'public/favicon.svg',
  'public/favicon.ico',
  'public/favicon.png',
  'public/favicon-32x32.png',
  'public/favicon-16x16.png',
  'public/icon.svg',
  'public/icon.png',
  'public/apple-touch-icon.png',
  'app/favicon.ico',
  'app/favicon.png',
  'app/icon.svg',
  'app/icon.png',
  'app/icon.ico',
  'src/favicon.ico',
  'src/favicon.svg',
  'src/app/favicon.ico',
  'src/app/icon.svg',
  'src/app/icon.png',
  'assets/favicon.svg',
  'assets/favicon.png',
  'assets/icon.svg',
  'assets/icon.png',
  'assets/logo.svg',
  'assets/logo.png',
]

const iconSourceFiles = [
  'index.html',
  'public/index.html',
  'src/index.html',
  'app/layout.tsx',
  'app/layout.jsx',
  'app/root.tsx',
  'app/root.jsx',
  'app/routes/__root.tsx',
  'src/app/layout.tsx',
  'src/app/layout.jsx',
  'src/root.tsx',
  'src/root.jsx',
  'src/routes/__root.tsx',
]

const linkIconHtmlPattern =
  /<link\b(?=[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon|mask-icon)["'])(?=[^>]*\bhref=["']([^"'#?]+))[^>]*>/gi
const linkIconObjectPattern =
  /(?=[^}]*\brel\s*:\s*["'](?:icon|shortcut icon|apple-touch-icon|mask-icon)["'])(?=[^}]*\bhref\s*:\s*["']([^"'#?]+))[^}]*/gi
const protocolRelativeHrefPattern = /^[a-z][a-z0-9+.-]*:/i
const leadingSlashPattern = /^\//

function isPathWithinProject(projectId: string, candidatePath: string) {
  const relative = path.relative(path.resolve(projectId), path.resolve(candidatePath))
  return relative === '' || !(relative.startsWith('..') || path.isAbsolute(relative))
}

function extractIconHrefs(source: string) {
  const hrefs: string[] = []
  for (const match of source.matchAll(linkIconHtmlPattern)) {
    if (match[1]) hrefs.push(match[1])
  }
  for (const match of source.matchAll(linkIconObjectPattern)) {
    if (match[1]) hrefs.push(match[1])
  }
  return hrefs
}

function resolveIconHref(projectId: string, href: string) {
  if (protocolRelativeHrefPattern.test(href) || href.startsWith('//')) return []
  const clean = href.replace(leadingSlashPattern, '')
  return [path.join(projectId, 'public', clean), path.join(projectId, clean)]
}

async function readFaviconCandidate(projectId: string, candidatePath: string) {
  if (!isPathWithinProject(projectId, candidatePath)) return null
  const ext = path.extname(candidatePath).toLowerCase()
  const mimeType = faviconMimeTypes[ext]
  if (!mimeType) return null
  try {
    const stats = await stat(candidatePath)
    if (!stats.isFile() || stats.size > 512 * 1024) return null
    const data = await readFile(candidatePath)
    return `data:${mimeType};base64,${data.toString('base64')}`
  } catch {
    return null
  }
}

async function loadProjectFaviconFromSourceFiles(normalizedProjectId: string) {
  for (const sourceFile of iconSourceFiles) {
    try {
      const source = await readFile(path.join(normalizedProjectId, sourceFile), 'utf8')
      for (const href of extractIconHrefs(source)) {
        for (const candidate of resolveIconHref(normalizedProjectId, href)) {
          const dataUrl = await readFaviconCandidate(normalizedProjectId, candidate)
          if (dataUrl) return dataUrl
        }
      }
    } catch {
      // Keep probing the next likely metadata file.
    }
  }

  return null
}

export async function loadProjectFavicon(projectId: string) {
  const normalizedProjectId = projectId.trim()
  if (!path.isAbsolute(normalizedProjectId)) return null

  for (const candidate of faviconCandidates) {
    const dataUrl = await readFaviconCandidate(
      normalizedProjectId,
      path.join(normalizedProjectId, candidate),
    )
    if (dataUrl) return dataUrl
  }

  return loadProjectFaviconFromSourceFiles(normalizedProjectId)
}
