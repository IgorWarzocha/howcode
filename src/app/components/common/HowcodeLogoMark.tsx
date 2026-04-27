import { cn } from "../../utils/cn";

type HowcodeLogoMarkProps = {
  className?: string;
};

export function HowcodeLogoMark({ className }: HowcodeLogoMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-[13px] font-semibold leading-none text-[#a9b1ea]",
        className,
      )}
    >
      H
    </span>
  );
}
