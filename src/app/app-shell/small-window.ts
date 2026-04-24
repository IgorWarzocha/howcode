export type AppWindowSize = {
  width: number;
  height: number;
};

// Temporary stopgap until the shell gets a real responsive-layout pass.
// Roughly half of a 1920x1080 display, matching the issue brief.
export const SMALL_WINDOW_MINIMUM_SIZE: AppWindowSize = {
  width: 960,
  height: 540,
};

export function isSmallAppWindow(
  size: AppWindowSize,
  minimum: AppWindowSize = SMALL_WINDOW_MINIMUM_SIZE,
) {
  return size.width < minimum.width || size.height < minimum.height;
}
