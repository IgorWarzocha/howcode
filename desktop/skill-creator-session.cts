import { mkdir, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Message, SkillCreatorSessionState } from "../shared/desktop-contracts.ts";
import { mapAgentMessagesToUiMessages } from "../shared/pi-message-mapper.ts";
import { loadAppSettings } from "./app-settings.cts";
import { getPiModule } from "./pi-module.cts";
import { createComposerSnapshotSession } from "./runtime/composer-state.cts";
import {
  getActiveGlobalSkillsRoot,
  getActiveProjectSkillsRoot,
  pathExists,
} from "./skills/paths.cts";

type SkillCreatorSessionEntry = {
  session: Awaited<ReturnType<typeof createSkillCreatorSession>>["session"];
  targetRootPath: string;
  createdSkillPath: string | null;
  initialSkillPaths: Set<string>;
  busy: boolean;
};

const skillCreatorSessions = new Map<string, SkillCreatorSessionEntry>();

async function listSkillPaths(skillsRootPath: string) {
  if (!(await pathExists(skillsRootPath))) {
    return [] as Array<{ path: string; mtimeMs: number }>;
  }

  const entries = await readdir(skillsRootPath, { withFileTypes: true });
  const skillPaths: Array<{ path: string; mtimeMs: number }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillPath = path.join(skillsRootPath, entry.name);
    const skillFilePath = path.join(skillPath, "SKILL.md");
    if (!(await pathExists(skillFilePath))) {
      continue;
    }

    const skillStats = await stat(skillFilePath);
    skillPaths.push({ path: skillPath, mtimeMs: skillStats.mtimeMs });
  }

  return skillPaths;
}

function pickDetectedSkillPath(
  skillPaths: Array<{ path: string; mtimeMs: number }>,
  initialSkillPaths: Set<string>,
  startedAtMs: number,
) {
  const newSkillPaths = skillPaths.filter((skillPath) => !initialSkillPaths.has(skillPath.path));
  if (newSkillPaths.length > 0) {
    return newSkillPaths.sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.path ?? null;
  }

  const modifiedSkillPaths = skillPaths.filter(
    (skillPath) => skillPath.mtimeMs >= startedAtMs - 1_000,
  );
  if (modifiedSkillPaths.length > 0) {
    return modifiedSkillPaths.sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.path ?? null;
  }

  return null;
}

function mapSkillCreatorMessages(messages: AgentMessage[]) {
  return mapAgentMessagesToUiMessages(messages)
    .filter(
      (message): message is Extract<Message, { role: "assistant" | "user" }> =>
        message.role === "assistant" || message.role === "user",
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content.join("\n\n"),
    }));
}

function buildInitialPrompt(input: {
  local: boolean;
  prompt: string;
  targetRootPath: string;
}) {
  const lines = [
    `Use your skill creator skill and its references to create a ${input.local ? "project-specific" : "globally reusable"} skill for this purpose:`,
    input.prompt.trim(),
  ];

  if (input.local) {
    lines.push("Inspect any project files you might need.");
  }

  lines.push(`Create the skill directly under this directory: ${input.targetRootPath}`);
  lines.push('When done, output only: "Done. Please review the changes."');
  return lines.join("\n\n");
}

function buildFollowUpPrompt(prompt: string, createdSkillPath: string | null) {
  const lines = [] as string[];

  if (createdSkillPath) {
    lines.push(`Continue editing the skill in place at: ${createdSkillPath}`);
  }

  lines.push(prompt.trim());
  lines.push('When done, output only: "Done. Please review the changes."');
  return lines.join("\n\n");
}

async function createSkillCreatorSession(cwd: string, projectPath?: string | null) {
  const {
    AuthStorage,
    DefaultResourceLoader,
    ModelRegistry,
    SessionManager,
    SettingsManager,
    createAgentSession,
    getAgentDir,
  } = await getPiModule();
  const agentDir = getAgentDir();
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage, `${agentDir}/models.json`);
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const packagedSkillsPath = new URL("../../resources/skills", import.meta.url).pathname;
  const repoSkillsPath = new URL("../../desktop/resources/skills", import.meta.url).pathname;
  const bundledSkillsPath = (await pathExists(packagedSkillsPath))
    ? packagedSkillsPath
    : repoSkillsPath;
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    additionalSkillPaths: [bundledSkillsPath],
  });
  await resourceLoader.reload();

  const selectedModel = loadAppSettings().skillCreatorModel;
  const snapshot = await createComposerSnapshotSession({ projectId: projectPath ?? cwd });
  let model = null as Awaited<ReturnType<typeof modelRegistry.getAvailable>>[number] | null;

  try {
    if (selectedModel) {
      const availableModels = await snapshot.session.modelRegistry.getAvailable();
      model =
        availableModels.find(
          (availableModel) =>
            availableModel.provider === selectedModel.provider &&
            availableModel.id === selectedModel.id,
        ) ?? null;
    }

    if (!model) {
      model = snapshot.session.model ?? null;
    }
  } finally {
    snapshot.session.dispose();
  }

  if (!model) {
    throw new Error("No skill creator model is available.");
  }

  return await createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    model,
    resourceLoader,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory(),
  });
}

async function runSkillCreatorPrompt(
  sessionEntry: SkillCreatorSessionEntry,
  prompt: string,
): Promise<SkillCreatorSessionState> {
  if (sessionEntry.busy) {
    throw new Error("Skill creator is already running.");
  }

  sessionEntry.busy = true;
  const startedAtMs = Date.now();

  try {
    await sessionEntry.session.prompt(prompt);

    if (!sessionEntry.createdSkillPath) {
      const skillPaths = await listSkillPaths(sessionEntry.targetRootPath);
      sessionEntry.createdSkillPath = pickDetectedSkillPath(
        skillPaths,
        sessionEntry.initialSkillPaths,
        startedAtMs,
      );
    }

    return {
      sessionId: sessionEntry.session.sessionId,
      messages: mapSkillCreatorMessages(sessionEntry.session.messages as AgentMessage[]),
      latestResponse: sessionEntry.session.getLastAssistantText() ?? null,
      createdSkillPath: sessionEntry.createdSkillPath,
    };
  } finally {
    sessionEntry.busy = false;
  }
}

export async function startSkillCreatorSession(request: {
  prompt: string;
  local?: boolean;
  projectPath?: string | null;
}) {
  const local = request.local === true;
  const launchCwd = local ? path.resolve(request.projectPath ?? "") : os.homedir();
  const targetRootPath = local
    ? getActiveProjectSkillsRoot(request.projectPath)
    : getActiveGlobalSkillsRoot();

  if (!targetRootPath) {
    throw new Error("Select a project before creating a project-specific skill.");
  }

  await mkdir(targetRootPath, { recursive: true });

  const initialSkillPaths = new Set(
    (await listSkillPaths(targetRootPath)).map((skillPath) => skillPath.path),
  );
  const { session } = await createSkillCreatorSession(launchCwd, request.projectPath);
  const sessionEntry: SkillCreatorSessionEntry = {
    session,
    targetRootPath,
    createdSkillPath: null,
    initialSkillPaths,
    busy: false,
  };
  skillCreatorSessions.set(session.sessionId, sessionEntry);

  try {
    return await runSkillCreatorPrompt(
      sessionEntry,
      buildInitialPrompt({
        local,
        prompt: request.prompt,
        targetRootPath,
      }),
    );
  } catch (error) {
    session.dispose();
    skillCreatorSessions.delete(session.sessionId);
    throw error;
  }
}

export async function continueSkillCreatorSession(request: { sessionId: string; prompt: string }) {
  const sessionEntry = skillCreatorSessions.get(request.sessionId);
  if (!sessionEntry) {
    throw new Error("That skill creator session is no longer available.");
  }

  return await runSkillCreatorPrompt(
    sessionEntry,
    buildFollowUpPrompt(request.prompt, sessionEntry.createdSkillPath),
  );
}

export async function closeSkillCreatorSession(request: { sessionId: string }) {
  const sessionEntry = skillCreatorSessions.get(request.sessionId);
  if (!sessionEntry) {
    return { ok: true };
  }

  sessionEntry.session.dispose();
  skillCreatorSessions.delete(request.sessionId);
  return { ok: true };
}
