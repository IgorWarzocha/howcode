import { useEffect, useState } from "react";

export function useToast(timeoutMs = 2200) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [toast, timeoutMs]);

  return {
    toast,
    showToast: setToast,
  };
}
