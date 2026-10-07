const downloadPathSeparatorPattern = /[\\/]/

export async function listArtifactsQuery(conversationId?: string | null) {
  return (await window.piDesktop?.listArtifacts?.(conversationId ?? null)) ?? []
}

export async function updateArtifactQuery(
  artifactSlug: string,
  content: string,
  conversationId?: string | null | undefined,
) {
  return (
    (await window.piDesktop?.updateArtifact?.(artifactSlug, content, conversationId ?? null)) ??
    null
  )
}

export async function listArtifactVersionsQuery(artifactSlug: string) {
  return (await window.piDesktop?.listArtifactVersions?.(artifactSlug)) ?? []
}

export async function compileReactArtifactQuery(source: string) {
  return (
    (await window.piDesktop?.compileReactArtifact?.(source)) ?? {
      ok: false as const,
      error: 'Artifact compiler is unavailable.',
      warnings: [],
    }
  )
}

export async function saveTextToDownloadsQuery(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.split(downloadPathSeparatorPattern).pop() || 'download.txt'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return { ok: true as const }
}
