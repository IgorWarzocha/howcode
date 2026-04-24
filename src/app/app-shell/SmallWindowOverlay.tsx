import { useEffect, useRef, useState } from "react";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { isSmallAppWindow, SMALL_WINDOW_MINIMUM_SIZE, type AppWindowSize } from "./small-window";

function getWindowSize(): AppWindowSize | null {
  if (typeof window === "undefined") {
    return null;
  }

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function SmallWindowOverlay() {
  const [windowSize, setWindowSize] = useState<AppWindowSize | null>(getWindowSize);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const overlayVisible = windowSize ? isSmallAppWindow(windowSize) : false;
  const overlayPresent = useAnimatedPresence(overlayVisible);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize(getWindowSize());
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!overlayVisible) {
      return;
    }

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frameId = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      previousActiveElement?.focus({ preventScroll: true });
    };
  }, [overlayVisible]);

  if (!overlayPresent) {
    return null;
  }

  return (
    <div
      data-open={overlayVisible ? "true" : "false"}
      className={`motion-overlay-panel fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(7,9,16,0.74)] px-6 py-8 backdrop-blur-md ${overlayVisible ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <dialog
        ref={dialogRef}
        open={true}
        aria-modal="true"
        aria-labelledby="small-window-overlay-title"
        aria-describedby="small-window-overlay-description"
        tabIndex={-1}
        onKeyDownCapture={(event) => {
          event.stopPropagation();
        }}
        className="m-0 w-full max-w-[30rem] border-0 rounded-[28px] bg-[linear-gradient(180deg,rgba(52,56,72,0.98),rgba(35,38,51,0.98))] p-3 text-left shadow-[0_30px_80px_rgba(0,0,0,0.42),inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      >
        <div className="rounded-[20px] bg-[rgba(10,13,22,0.32)] px-6 py-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted)]">
            Window too small
          </p>
          <h2
            id="small-window-overlay-title"
            className="mb-3 text-balance text-[22px] font-semibold leading-[1.12] text-[color:var(--text)]"
          >
            howcode works best with a little more room.
          </h2>
          <p
            id="small-window-overlay-description"
            className="text-pretty text-[14px] leading-6 text-[color:var(--muted)]"
          >
            Please run the app at roughly half of a full HD screen for the best experience. Proper
            responsive layout will come eventually.
          </p>
          <div
            aria-hidden="true"
            className="mt-5 grid gap-2 rounded-2xl bg-[rgba(255,255,255,0.045)] p-3 text-[12px] leading-5 text-[color:var(--muted)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)] sm:grid-cols-2"
          >
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                Current
              </span>
              <span className="font-mono tabular-nums text-[color:var(--text)]">
                {windowSize?.width ?? "—"} × {windowSize?.height ?? "—"}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-2)]">
                Minimum
              </span>
              <span className="font-mono tabular-nums text-[color:var(--text)]">
                {SMALL_WINDOW_MINIMUM_SIZE.width} × {SMALL_WINDOW_MINIMUM_SIZE.height}
              </span>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
