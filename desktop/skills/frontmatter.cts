function normalizeSkillName(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function extractFrontmatter(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match?.[1] ?? null;
}

export function parseSkillFrontmatter(markdown: string) {
  const frontmatter = extractFrontmatter(markdown);
  if (!frontmatter) {
    return { name: null, description: null };
  }

  const lines = frontmatter.replace(/\r/g, "").split("\n");
  let name: string | null = null;
  let description: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    const nameMatch = line.match(/^name:\s*(.+?)\s*$/);
    if (nameMatch) {
      name = normalizeSkillName(nameMatch[1]);
      continue;
    }

    const descriptionMatch = line.match(/^description:\s*(.*)$/);
    if (!descriptionMatch) {
      continue;
    }

    const rawDescription = descriptionMatch[1]?.trim() ?? "";
    if (["|", ">", "|-", ">-", "|+", ">+"].includes(rawDescription)) {
      const blockLines: string[] = [];

      for (index += 1; index < lines.length; index += 1) {
        const blockLine = lines[index] ?? "";

        if (blockLine.trim().length === 0) {
          blockLines.push("");
          continue;
        }

        if (!/^\s+/.test(blockLine)) {
          index -= 1;
          break;
        }

        blockLines.push(blockLine.replace(/^\s{2}/, ""));
      }

      description = blockLines.join("\n").trim().replace(/\s+/g, " ");
      continue;
    }

    description = normalizeSkillName(rawDescription);
  }

  return {
    name,
    description,
  };
}
