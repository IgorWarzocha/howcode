// Keep this allowlist aligned with src/app/desktop/actions.ts until the Electron
// shell is moved to TypeScript or a generated shared contract.
const DESKTOP_ACTIONS = [
  "nav.back",
  "nav.forward",
  "threads.collapse-all",
  "threads.filter",
  "project.add",
  "project.select",
  "project.expand",
  "project.collapse",
  "project.actions",
  "project.switch",
  "thread.new",
  "thread.open",
  "thread.archive",
  "thread.pin",
  "thread.actions",
  "thread.run-action",
  "workspace.open",
  "workspace.secondary",
  "workspace.popout",
  "product.menu",
  "connections.add",
  "connections.dismiss-banner",
  "composer.attach-menu",
  "composer.model",
  "composer.thinking",
  "composer.dictate",
  "composer.send",
  "composer.host",
  "composer.profile",
  "plugins.open-card",
  "automations.open-card",
  "debug.open-card",
  "landing.project-switcher",
  "diff.review",
  "terminal.close",
];

const DEFAULT_SHELL_STATE = Object.freeze({
  platform: process.platform,
  mockMode: true,
  productName: "Pi Desktop Mock",
  cwd: process.cwd(),
  agentDir: "",
  sessionDir: "",
  projects: [],
  availableHosts: ["Local"],
  composerProfiles: ["Pi session"],
});

function isDesktopAction(action) {
  return typeof action === "string" && DESKTOP_ACTIONS.includes(action);
}

module.exports = {
  DESKTOP_ACTIONS,
  DEFAULT_SHELL_STATE,
  isDesktopAction,
};
