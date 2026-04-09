import { PackagePlus, Sparkles } from "lucide-react";
import { TextButton } from "../../../components/common/TextButton";
import { Tooltip } from "../../../components/common/Tooltip";
import { compactRoundIconButtonClass, settingsInputClass } from "../../../ui/classes";
import type { InstallScope, ManualSourceKind } from "../types";
import { SegmentedToggle } from "./SegmentedToggle";

type InstallExtensionsSectionProps = {
  manualSource: string;
  manualSourceKind: ManualSourceKind;
  installScope: InstallScope;
  projectScopeAvailable: boolean;
  hasManualSource: boolean;
  hasPendingInstall: boolean;
  manualInstallPending: boolean;
  onManualSourceChange: (value: string) => void;
  onManualSourceKindChange: (kind: ManualSourceKind) => void;
  onSubmit: () => void | Promise<void>;
};

const sourceKindOptions = [
  { value: "npm", label: "npm" },
  { value: "git", label: "git" },
] as const;

export function InstallExtensionsSection({
  manualSource,
  manualSourceKind,
  installScope,
  projectScopeAvailable,
  hasManualSource,
  hasPendingInstall,
  manualInstallPending,
  onManualSourceChange,
  onManualSourceKindChange,
  onSubmit,
}: InstallExtensionsSectionProps) {
  const disabled =
    (!projectScopeAvailable && installScope === "project") ||
    !hasManualSource ||
    manualInstallPending ||
    hasPendingInstall;

  return (
    <div className="grid gap-2">
      <div className="inline-flex items-center gap-1.5 text-left text-[13px] font-medium text-[color:var(--text)]">
        <span>Install</span>
      </div>

      <form
        className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <SegmentedToggle
          value={manualSourceKind}
          options={sourceKindOptions}
          onChange={onManualSourceKindChange}
        />

        <input
          type="text"
          value={manualSource}
          onChange={(event) => onManualSourceChange(event.target.value)}
          className={settingsInputClass}
          placeholder={
            manualSourceKind === "npm"
              ? "Package name or npm:@scope/pkg"
              : "git:github.com/user/repo or https://…"
          }
          aria-label={manualSourceKind === "npm" ? "Install npm package" : "Install git package"}
        />

        <Tooltip content={hasManualSource ? `Install ${manualSourceKind} source` : "Install"}>
          <TextButton
            type="submit"
            className={`${compactRoundIconButtonClass} disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[color:var(--muted)] disabled:opacity-40`}
            disabled={disabled}
            aria-label={hasManualSource ? `Install ${manualSourceKind} source` : "Install"}
          >
            {manualInstallPending ? <Sparkles size={14} /> : <PackagePlus size={14} />}
          </TextButton>
        </Tooltip>
      </form>
    </div>
  );
}
