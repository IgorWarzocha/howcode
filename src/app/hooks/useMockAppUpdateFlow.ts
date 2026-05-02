import { useEffect, useState } from "react";

export const mockUpdateSteps = [
  { id: "latest", label: "0.1.2 latest", action: "Check" },
  { id: "available", label: "Update available", action: "Update" },
  { id: "downloading", label: "Downloading update…", action: "Downloading" },
  { id: "installing", label: "Installing update…", action: "Installing" },
  { id: "ready", label: "Update ready", action: "Restart" },
  { id: "restarting", label: "Restarting…", action: "Restarting" },
  { id: "complete", label: "0.1.3 latest", action: "Again" },
] as const;

type MockUpdateStepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function useMockAppUpdateFlow() {
  const [stepIndex, setStepIndex] = useState<MockUpdateStepIndex>(0);
  const [isRunning, setIsRunning] = useState(false);
  const step = mockUpdateSteps[stepIndex];

  useEffect(() => {
    if (!isRunning || stepIndex >= mockUpdateSteps.length - 1) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStepIndex(
        (current) => Math.min(current + 1, mockUpdateSteps.length - 1) as MockUpdateStepIndex,
      );
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [isRunning, stepIndex]);

  useEffect(() => {
    if (stepIndex === mockUpdateSteps.length - 1) {
      setIsRunning(false);
    }
  }, [stepIndex]);

  const advance = () => {
    if (step.id === "complete") {
      setStepIndex(0);
      setIsRunning(false);
      return;
    }

    setIsRunning(true);
    if (step.id === "latest") {
      setStepIndex(1);
    }
  };

  return { step, isRunning, advance };
}
