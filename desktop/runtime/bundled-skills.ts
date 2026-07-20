export function getBundledSkillPaths() {
  // biome-ignore lint/complexity/useLiteralKeys: process.env is typed with an index signature.
  const bundledSkillsPath = process.env['HOWCODE_BUNDLED_SKILLS_PATH']?.trim()
  return bundledSkillsPath ? [bundledSkillsPath] : []
}
