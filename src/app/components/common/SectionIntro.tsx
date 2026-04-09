import type { ElementType, ReactNode } from "react";
import { sectionDescriptionClass, sectionIntroClass, sectionTitleClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type SectionIntroProps = {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  titleAs?: ElementType;
};

export function SectionIntro({
  title,
  description,
  className,
  titleAs: TitleTag = "h2",
}: SectionIntroProps) {
  return (
    <div className={cn(sectionIntroClass, className)}>
      <TitleTag className={sectionTitleClass}>{title}</TitleTag>
      {description ? <p className={sectionDescriptionClass}>{description}</p> : null}
    </div>
  );
}
