import { PackagePlus, Sparkles } from "lucide-react";
import { SectionIntro } from "../../../components/common/SectionIntro";
import { SegmentedToggle } from "../../../components/common/SegmentedToggle";
import { TextButton } from "../../../components/common/TextButton";
import { Tooltip } from "../../../components/common/Tooltip";
import {
  compactRoundIconButtonClass,
  iconActionButtonDisabledClass,
  settingsInputClass,
} from "../../../ui/classes";
import type { InstallScope, ManualSourceKind } from "../types";

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
      <SectionIntro title="Install" titleAs="div" />

      <form
        className="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <SegmentedToggle
          ariaLabel="Extension source type"
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
            className={`${compactRoundIconButtonClass} ${iconActionButtonDisabledClass}`}
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
