import { useEffect } from "react";
import type { PiThemeState } from "../desktop/types";

const storageKey = "howcode:pi-gui-theme:v1";

const managedVars = [
  "--bg",
  "--sidebar",
  "--workspace",
  "--panel",
  "--panel-2",
  "--panel-3",
  "--border",
  "--border-strong",
  "--text",
  "--muted",
  "--muted-2",
  "--accent",
  "--accent-bg-subtle",
  "--accent-bg",
  "--accent-bg-strong",
  "--accent-border",
  "--accent-contrast",
  "--surface-hover",
  "--green",
  "--danger",
  "--danger-bg",
  "--danger-border",
  "--warning",
  "--warning-bg",
  "--terminal-bg",
  "--message-user-bg",
  "--message-assistant-bg",
  "--message-tool-bg",
  "--message-code-bg",
  "--markdown-heading",
  "--markdown-link",
  "--markdown-code",
  "--markdown-code-bg",
  "--markdown-quote",
  "--shadow",
] as const;

type GuiThemeValues = Record<(typeof managedVars)[number], string> & {
  colorScheme: "dark" | "light";
};

function hexToRgb(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;
  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
}

function luminance(hex: string | undefined) {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return 0;
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function rgba(hex: string | undefined, alpha: number, fallback: string) {
  if (!hex) return fallback;
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : fallback;
}

function mix(
  left: string | undefined,
  right: string | undefined,
  amount: number,
  fallback: string,
) {
  const a = left ? hexToRgb(left) : null;
  const b = right ? hexToRgb(right) : null;
  if (!a || !b) return fallback;
  const channel = (l: number, r: number) => Math.round(l + (r - l) * amount);
  return `#${[channel(a.r, b.r), channel(a.g, b.g), channel(a.b, b.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function getThemeValues(piTheme: PiThemeState): GuiThemeValues {
  const { colors, exportColors, isLight } = piTheme;
  const pageBg = exportColors.pageBg ?? colors.toolPendingBg ?? colors.userMessageBg;
  const panel = exportColors.cardBg ?? colors.userMessageBg;
  const workspace = exportColors.pageBg ?? colors.toolPendingBg;
  const text = colors.text;
  const muted = colors.muted;
  const dim = colors.dim;
  const accent = colors.accent;
  const accentIsLight = luminance(accent) > 0.5;

  return {
    "--bg": pageBg,
    "--sidebar": mix(panel, pageBg, 0.35, panel),
    "--workspace": workspace,
    "--panel": panel,
    "--panel-2": colors.toolPendingBg ?? panel,
    "--panel-3": colors.selectedBg ?? panel,
    "--border": rgba(text, isLight ? 0.16 : 0.09, "rgba(169, 178, 215, 0.075)"),
    "--border-strong": rgba(text, isLight ? 0.26 : 0.16, "rgba(169, 178, 215, 0.14)"),
    "--text": text,
    "--muted": muted,
    "--muted-2": dim,
    "--accent": accent,
    "--accent-bg-subtle": rgba(accent, isLight ? 0.08 : 0.1, "rgba(185, 191, 243, 0.08)"),
    "--accent-bg": rgba(accent, isLight ? 0.14 : 0.16, "rgba(185, 191, 243, 0.14)"),
    "--accent-bg-strong": rgba(accent, isLight ? 0.22 : 0.24, "rgba(185, 191, 243, 0.22)"),
    "--accent-border": rgba(accent, isLight ? 0.36 : 0.32, "rgba(185, 191, 243, 0.28)"),
    "--accent-contrast": accentIsLight ? "#111318" : "#ffffff",
    "--surface-hover": rgba(text, isLight ? 0.08 : 0.05, "rgba(255, 255, 255, 0.04)"),
    "--green": colors.success,
    "--danger": colors.error,
    "--danger-bg": rgba(colors.error, isLight ? 0.12 : 0.16, "rgba(255, 94, 94, 0.14)"),
    "--danger-border": rgba(colors.error, isLight ? 0.36 : 0.3, "rgba(255, 110, 110, 0.3)"),
    "--warning": colors.warning,
    "--warning-bg": rgba(colors.warning, isLight ? 0.12 : 0.14, "rgba(255, 204, 102, 0.14)"),
    "--terminal-bg": exportColors.pageBg ?? colors.toolPendingBg ?? pageBg,
    "--message-user-bg": colors.userMessageBg ?? panel,
    "--message-assistant-bg": colors.customMessageBg ?? panel,
    "--message-tool-bg": colors.toolPendingBg ?? panel,
    "--message-code-bg": colors.mdCodeBlock
      ? rgba(colors.mdCodeBlock, 0.1, colors.toolPendingBg)
      : colors.toolPendingBg,
    "--markdown-heading": colors.mdHeading ?? accent,
    "--markdown-link": colors.mdLink ?? accent,
    "--markdown-code": colors.mdCode ?? accent,
    "--markdown-code-bg": rgba(
      colors.mdCode ?? accent,
      isLight ? 0.1 : 0.14,
      "rgba(138,190,183,0.14)",
    ),
    "--markdown-quote": colors.mdQuote ?? muted,
    "--shadow": isLight ? "0 12px 36px rgba(0, 0, 0, 0.12)" : "0 12px 36px rgba(6, 7, 13, 0.18)",
    colorScheme: isLight ? "light" : "dark",
  };
}

function applyValues(values: GuiThemeValues) {
  const root = document.documentElement;
  root.style.colorScheme = values.colorScheme;
  for (const property of managedVars) {
    root.style.setProperty(property, values[property]);
  }
}

export function applyStoredPiGuiTheme() {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const values = JSON.parse(stored) as Partial<GuiThemeValues>;
    if (values.colorScheme !== "dark" && values.colorScheme !== "light") return;
    if (!managedVars.every((property) => typeof values[property] === "string")) return;
    applyValues(values as GuiThemeValues);
  } catch {
    // Ignore stale or invalid cached theme state.
  }
}

export function usePiGuiTheme(piTheme: PiThemeState | null | undefined) {
  useEffect(() => {
    if (!piTheme) return;

    const values = getThemeValues(piTheme);
    applyValues(values);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      // Best effort only; the live theme is still applied.
    }
  }, [piTheme]);
}
