import { Bot, Package, Sparkles, WandSparkles } from "lucide-react";
import type { FeatureCard, Message, Project } from "../types";

export const mockProjects: Project[] = [
  {
    id: "pi-plugin-codex",
    name: "pi-plugin-codex",
    subtitle: "pi desktop",
    threads: [
      { id: "inspect-current-repo", title: "Inspect current repo", age: "1d", pinned: true },
    ],
  },
  { id: "codapter", name: "codapter", threads: [] },
  { id: "sitegeist", name: "sitegeist", threads: [] },
  {
    id: "orby",
    name: "orby",
    threads: [{ id: "plan-clippy", title: "Plan clippy-orby agent orb", age: "2w" }],
  },
  {
    id: "sts2",
    name: "STS2",
    threads: [
      { id: "slay-spire", title: "Explore interacting with Slay the Sp", age: "2w" },
      { id: "ironclad", title: "Document ironclad optimal picks", age: "2w" },
    ],
  },
  {
    id: "siu",
    name: "SIU",
    threads: [{ id: "siu-loop", title: "Plan SIU standalone agent loop", age: "2w" }],
  },
  {
    id: "jobs",
    name: "jobs",
    threads: [{ id: "jobs-ai", title: "Identify profitable AI-native jobs", age: "2w" }],
  },
  {
    id: "symphony",
    name: "symphony",
    threads: [{ id: "symphony-framework", title: "Implement symphony framework", age: "2w" }],
  },
  { id: "pi-codex-conversion", name: "pi-codex-conversion", collapsed: true, threads: [] },
  { id: "claw-phone", name: "claw-phone", collapsed: true, threads: [] },
  { id: "clawcord", name: "clawcord", collapsed: true, threads: [] },
];

export const threadMessages: Message[] = [
  {
    id: "assistant-1",
    role: "assistant",
    format: "list",
    content: [
      "no ad hoc temp session dirs in normal use",
      "same built-in session continuation",
      "fail clearly when a provider/model returns an empty assistant message instead of fabricating an answer",
    ],
  },
  {
    id: "user-1",
    role: "user",
    content: [
      "lol yeah just fix it. it has to be somewhat similar to running a codex subagent via pi. unsure what you created rn.",
    ],
  },
  {
    id: "assistant-2",
    role: "assistant",
    content: [
      "The plugin is fixed into the shape it should have been.",
      "The core change is in `pi_run.py` (line 118): it now extracts only the final assistant response, not arbitrary text from the event stream, and it fails hard on broken model output instead of inventing an answer. The hard-failure path is in `pi_run.py` (line 240), and the wrapper keeps using a workspace-scoped session automatically so normal usage no longer needs random temp session dirs.",
      "I also updated the skill contract in `SKILL.md` (line 10) and the plugin docs in `README.md` (line 5) to describe it as a bounded Pi subagent handoff.",
      "I synced the changes into the installed cache under `/home/igorw/.codex/plugins/cache/local-dev/pi-coding-agent/local/...` and verified the real plugin path end to end. A clean Codex run through the plugin produced: `first: 391` and `second: 410`.",
      "I also verified the broken GLM case. `zai/glm-5-turbo` is still returning an empty assistant message through `pi` here, but the plugin now reports that honestly as `empty_assistant_response` instead of echoing the prompt back.",
      "So yes: you can now use it in the intended way, as a Pi-backed delegated thread with normal workspace session continuity via `--continue`, not as ad hoc shell glue.",
    ],
  },
];

export const threadPreviousMessageCount = 7;

export const pluginCards: FeatureCard[] = [
  {
    title: "Pi skills",
    description: "Expose first-class skill discovery, install, enable, and run flows.",
    icon: Sparkles,
  },
  {
    title: "Extension registry",
    description: "List loaded extensions, scopes, and active widgets with future hot-reload stubs.",
    icon: Package,
  },
  {
    title: "Prompt templates",
    description: "Mirror slash-command and prompt-template affordances in a desktop-first surface.",
    icon: WandSparkles,
  },
];

export const automationCards: FeatureCard[] = [
  {
    title: "Remote runs",
    description: "Queue background Pi sessions on remote machines and resume them locally later.",
    icon: Bot,
  },
  {
    title: "Review workflows",
    description: "Codex-style run actions, branch staging, and approval checkpoints.",
    icon: Bot,
  },
  {
    title: "Workspace routines",
    description: "Saved project automations for setup, lint, fix, test, and release.",
    icon: Bot,
  },
];

export const debugCards: FeatureCard[] = [
  {
    title: "Event stream",
    description: "Message, turn, tool, and queue events from the future Pi SDK session adapter.",
    icon: Bot,
  },
  {
    title: "Model transport",
    description: "Provider, model, thinking level, queue mode, and retry diagnostics.",
    icon: Bot,
  },
  {
    title: "Renderer inspector",
    description: "UI snapshot/debug state for landing, thread, diff, terminal, and popout shells.",
    icon: Bot,
  },
];
