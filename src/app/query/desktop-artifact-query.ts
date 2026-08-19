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
  return (
    (await window.piDesktop?.saveTextToDownloads?.(fileName, content)) ?? {
      ok: false as const,
      error: 'Desktop downloads are unavailable.',
    }
  )
}
