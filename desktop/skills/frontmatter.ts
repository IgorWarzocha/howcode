const quotedSkillNamePattern = /^['"]|['"]$/g
const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const nameFieldPattern = /^name:\s*(.+?)\s*$/
const descriptionFieldPattern = /^description:\s*(.*)$/
const indentedLinePattern = /^\s+/
const twoSpaceIndentPattern = /^\s{2}/
const whitespaceRunPattern = /\s+/g

function normalizeSkillName(value: string) {
  return value.trim().replace(quotedSkillNamePattern, '')
}

function extractFrontmatter(markdown: string) {
  const match = markdown.match(frontmatterPattern)
  return match?.[1] ?? null
}

function parseDescriptionBlock(lines: string[], startIndex: number) {
  const blockLines: string[] = []
  let index = startIndex

  for (; index < lines.length; index += 1) {
    const blockLine = lines[index] ?? ''

    if (blockLine.trim().length === 0) {
      blockLines.push('')
      continue
    }

    if (!indentedLinePattern.test(blockLine)) {
      break
    }

    blockLines.push(blockLine.replace(twoSpaceIndentPattern, ''))
  }

  return {
    description: blockLines.join('\n').trim().replace(whitespaceRunPattern, ' '),
    nextIndex: index - 1,
  }
}

function parseDescriptionValue(lines: string[], rawDescription: string, nextLineIndex: number) {
  if (!['|', '>', '|-', '>-', '|+', '>+'].includes(rawDescription)) {
    return { description: normalizeSkillName(rawDescription), nextIndex: nextLineIndex - 1 }
  }

  return parseDescriptionBlock(lines, nextLineIndex)
}

export function parseSkillFrontmatter(markdown: string) {
  const frontmatter = extractFrontmatter(markdown)
  if (!frontmatter) {
    return { name: null, description: null }
  }

  const lines = frontmatter.replace(/\r/g, '').split('\n')
  let name: string | null = null
  let description: string | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''

    const nameMatch = line.match(nameFieldPattern)
    if (nameMatch) {
      name = normalizeSkillName(nameMatch[1] ?? '')
      continue
    }

    const descriptionMatch = line.match(descriptionFieldPattern)
    if (!descriptionMatch) {
      continue
    }

    const rawDescription = descriptionMatch[1]?.trim() ?? ''
    const parsedDescription = parseDescriptionValue(lines, rawDescription, index + 1)
    description = parsedDescription.description
    index = parsedDescription.nextIndex
  }

  return {
    name,
    description,
  }
}
