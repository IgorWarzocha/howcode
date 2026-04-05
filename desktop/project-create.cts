import { mkdir } from "node:fs/promises";
import path from "node:path";
import { startNewThread } from "./pi-desktop-runtime.cts";
import { initializeProjectGit } from "./project-git.cts";
import { moveProjectToTop } from "./thread-state-db.cts";

function sanitizeProjectFolderName(projectName: string) {
  let nextName = projectName
    .trim()
    .replaceAll(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ");

  nextName = Array.from(nextName, (char) => {
    const code = char.charCodeAt(0);
    return code >= 0 && code <= 31 ? "-" : char;
  }).join("");

  return nextName;
}

export async function createProject(options: {
  preferredProjectLocation: string | null;
  projectName: string;
  initializeGit: boolean;
}) {
  const preferredProjectLocation = options.preferredProjectLocation?.trim() ?? "";
  if (preferredProjectLocation.length === 0) {
    throw new Error("Set a default project location in Settings first.");
  }

  const folderName = sanitizeProjectFolderName(options.projectName);
  if (folderName.length === 0) {
    throw new Error("Enter a project name.");
  }

  const parentDirectory = path.resolve(preferredProjectLocation);
  const projectPath = path.join(parentDirectory, folderName);

  await mkdir(parentDirectory, { recursive: true });

  try {
    await mkdir(projectPath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
      throw new Error("A project with that name already exists there.");
    }

    throw error;
  }

  if (options.initializeGit) {
    await initializeProjectGit(projectPath);
  }

  const result = await startNewThread({ projectId: projectPath });
  moveProjectToTop(projectPath);
  return result;
}
