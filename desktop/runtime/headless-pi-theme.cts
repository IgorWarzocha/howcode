import { getPiModule } from "../pi-module.cts";

type PiThemeSettings = {
  getTheme(): string | undefined;
};

export async function initHeadlessPiTheme(settingsManager: PiThemeSettings) {
  const { initTheme } = await getPiModule();
  initTheme(settingsManager.getTheme(), false);
}
