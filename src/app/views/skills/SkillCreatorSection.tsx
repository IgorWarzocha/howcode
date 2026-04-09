import { CornerDownLeft, FolderOpen, RefreshCw } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { TextButton } from "../../components/common/TextButton";
import { ThreeDotsSpinner } from "../../components/common/ThreeDotsSpinner";
import { Tooltip } from "../../components/common/Tooltip";
import {
  closeSkillCreatorSessionQuery,
  continueSkillCreatorSessionQuery,
  startSkillCreatorSessionQuery,
} from "../../query/desktop-query";
import { settingsInputClass } from "../../ui/classes";
import { cn } from "../../utils/cn";
import { getActionError } from "./helpers";

type SkillCreatorSectionProps = {
  installScope: "global" | "project";
  projectPath: string | null;
  skillCreatorDetected: boolean;
  onRefreshSkillCreatorDetection: () => Promise<unknown>;
  onInvalidateConfiguredSkillsCaches: () => void;
  onSetActionError: (value: string | null) => void;
};

export function SkillCreatorSection({
  installScope,
  projectPath,
  skillCreatorDetected,
  onRefreshSkillCreatorDetection,
  onInvalidateConfiguredSkillsCaches,
  onSetActionError,
}: SkillCreatorSectionProps) {
  const [mockSkillCreatorInstalled, setMockSkillCreatorInstalled] = useState(false);
  const [createSkillDraft, setCreateSkillDraft] = useState("");
  const [skillCreatorSessionId, setSkillCreatorSessionId] = useState<string | null>(null);
  const [skillCreatorLatestResponse, setSkillCreatorLatestResponse] = useState<string | null>(null);
  const [createdSkillPath, setCreatedSkillPath] = useState<string | null>(null);
  const [skillCreatorBusy, setSkillCreatorBusy] = useState(false);
  const previousDestinationRef = useRef({
    installScope,
    projectPath,
  });

  const skillCreatorReady = skillCreatorDetected || mockSkillCreatorInstalled;
  const canSubmitCreateSkill =
    !skillCreatorBusy &&
    (createSkillDraft.trim().length > 0 ||
      skillCreatorSessionId !== null ||
      skillCreatorLatestResponse !== null);
  const createSkillPlaceholder = skillCreatorLatestResponse
    ? "Tell the agent what you want changed or send an empty line to start creating a new skill."
    : "Describe the skill you want";

  useEffect(() => {
    return () => {
      if (skillCreatorSessionId) {
        void closeSkillCreatorSessionQuery(skillCreatorSessionId);
      }
    };
  }, [skillCreatorSessionId]);

  const resetSkillCreatorSession = useCallback(async () => {
    if (skillCreatorSessionId) {
      await closeSkillCreatorSessionQuery(skillCreatorSessionId);
    }

    setSkillCreatorSessionId(null);
    setSkillCreatorLatestResponse(null);
    setCreatedSkillPath(null);
    setCreateSkillDraft("");
    onSetActionError(null);
  }, [onSetActionError, skillCreatorSessionId]);

  useEffect(() => {
    const previousDestination = previousDestinationRef.current;
    const destinationChanged =
      previousDestination.installScope !== installScope ||
      previousDestination.projectPath !== projectPath;

    previousDestinationRef.current = {
      installScope,
      projectPath,
    };

    if (!skillCreatorSessionId || !destinationChanged) {
      return;
    }

    void resetSkillCreatorSession();
  }, [installScope, projectPath, resetSkillCreatorSession, skillCreatorSessionId]);

  const handleSubmitCreateSkill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (skillCreatorBusy) {
      return;
    }

    const prompt = createSkillDraft.trim();
    if (prompt.length === 0) {
      if (skillCreatorSessionId || skillCreatorLatestResponse) {
        await resetSkillCreatorSession();
      }
      return;
    }

    setSkillCreatorBusy(true);
    onSetActionError(null);

    try {
      const sessionState = skillCreatorSessionId
        ? await continueSkillCreatorSessionQuery({
            sessionId: skillCreatorSessionId,
            prompt,
          })
        : await startSkillCreatorSessionQuery({
            prompt,
            local: installScope === "project",
            projectPath,
          });

      if (!sessionState) {
        throw new Error("Could not start the skill creator.");
      }

      setSkillCreatorSessionId(sessionState.sessionId);
      setSkillCreatorLatestResponse(sessionState.latestResponse);
      setCreatedSkillPath(sessionState.createdSkillPath);
      setCreateSkillDraft("");
      onInvalidateConfiguredSkillsCaches();
    } catch (error) {
      onSetActionError(getActionError(error));
    } finally {
      setSkillCreatorBusy(false);
    }
  };

  return (
    <section className="grid gap-2">
      <div className="inline-flex items-center gap-2 text-[13px] font-medium text-[color:var(--text)]">
        <span>Create a skill</span>
      </div>

      <div className="grid gap-1.5 text-[12px] leading-5 text-[color:var(--muted)]">
        {skillCreatorReady ? (
          <div className="grid gap-2">
            <div className="px-0.5 py-0.5">
              {skillCreatorBusy ? (
                <div className="inline-flex items-center gap-2 rounded-xl bg-[rgba(255,255,255,0.03)] px-2.5 py-2 text-[12px] leading-5 text-[color:var(--muted)]">
                  <span>Pi is working</span>
                  <ThreeDotsSpinner className="text-[color:var(--muted)]" />
                </div>
              ) : skillCreatorLatestResponse ? (
                <div className="rounded-xl bg-[rgba(255,255,255,0.03)] px-2.5 py-2 text-[12px] leading-5 text-[color:var(--muted)]">
                  {skillCreatorLatestResponse}
                </div>
              ) : (
                <div className="rounded-xl bg-[rgba(255,255,255,0.03)] px-2.5 py-2 text-[12px] leading-5 text-[color:var(--muted)]">
                  This spawns a temporary chat session. For complex project-skills, please use
                  normal chat for best results.
                </div>
              )}
            </div>

            <form
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
              onSubmit={(event) => {
                void handleSubmitCreateSkill(event);
              }}
            >
              <div className="relative">
                <input
                  type="text"
                  value={createSkillDraft}
                  onChange={(event) => setCreateSkillDraft(event.target.value)}
                  className={cn(settingsInputClass, "w-full pr-7")}
                  placeholder={createSkillPlaceholder}
                  aria-label="Describe the skill you want"
                  disabled={skillCreatorBusy}
                />
                <Tooltip content="Press Enter to send">
                  <button
                    type="submit"
                    className="absolute inset-y-0 right-2 flex items-center justify-center text-[color:var(--muted)] transition-colors hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!canSubmitCreateSkill}
                    aria-label="Send skill creator message"
                  >
                    <span className="flex h-3.5 w-3.5 items-center justify-center">
                      <CornerDownLeft size={12} strokeWidth={2} className="block" />
                    </span>
                  </button>
                </Tooltip>
              </div>

              <TextButton
                className="inline-flex h-auto items-center gap-1 rounded-xl px-1.5 py-0 text-[12px]"
                onClick={() => {
                  if (createdSkillPath) {
                    void window.piDesktop?.openPath?.(createdSkillPath);
                  }
                }}
                disabled={!createdSkillPath}
              >
                <span>Open folder</span>
                <FolderOpen size={11} />
              </TextButton>
            </form>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span>
                No skill creator detected for this scope. Install the bundled skill creator?
              </span>
              <TextButton
                className="h-auto rounded-md px-1.5 py-0 text-[12px] text-[color:var(--text)]"
                onClick={() => {
                  onSetActionError(null);
                  setMockSkillCreatorInstalled(true);
                }}
              >
                Yes
              </TextButton>
              <TextButton
                className="inline-flex h-auto items-center gap-1 rounded-md px-1.5 py-0 text-[12px]"
                onClick={() => {
                  void onRefreshSkillCreatorDetection();
                }}
              >
                <span>No - I have provided my own</span>
                <RefreshCw size={11} />
              </TextButton>
            </div>
            <div>
              Please note this skill creator is agent-agnostic, as opposed to most of the skill
              creator skills you will find for other harnesses and agents.
            </div>
          </>
        )}
      </div>
    </section>
  );
}
