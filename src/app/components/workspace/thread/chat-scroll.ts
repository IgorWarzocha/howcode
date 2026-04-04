export const CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 64;

type ScrollPosition = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
};

export function isScrollContainerNearBottom(
  position: ScrollPosition,
  thresholdPx = CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
) {
  const threshold = Number.isFinite(thresholdPx)
    ? Math.max(0, thresholdPx)
    : CHAT_AUTO_SCROLL_BOTTOM_THRESHOLD_PX;

  const { scrollTop, clientHeight, scrollHeight } = position;
  if (![scrollTop, clientHeight, scrollHeight].every(Number.isFinite)) {
    return true;
  }

  return scrollHeight - clientHeight - scrollTop <= threshold;
}
