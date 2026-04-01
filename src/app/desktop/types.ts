import type { DesktopAction } from "./actions";

export type ShellState = {
  platform: string;
  mockMode: boolean;
  productName: string;
  availableHosts: string[];
  composerProfiles: string[];
};

export type DesktopActionPayload = Record<string, unknown>;

export type DesktopActionResult = {
  ok: boolean;
  at: string;
  payload: {
    action: DesktopAction;
    payload: DesktopActionPayload;
  };
};
