import { Wrench } from "lucide-react";
import { FeatureCard as FeatureCardButton } from "../components/common/FeatureCard";
import { FeatureStatusBadge } from "../components/common/FeatureStatusBadge";
import { PageIntro } from "../components/common/PageIntro";
import type { DesktopAction } from "../desktop/actions";
import type { FeatureStatusId } from "../features/feature-status";
import type { FeatureCard } from "../types";
import { sectionShellClass } from "../ui/classes";

type CardGridViewProps = {
  eyebrow: string;
  title: string;
  description: string;
  cards: FeatureCard[];
  action: DesktopAction;
  statusId: FeatureStatusId;
  onAction: (action: DesktopAction, payload?: Record<string, unknown>) => void;
};

export function CardGridView({
  eyebrow,
  title,
  description,
  cards,
  action,
  statusId,
  onAction,
}: CardGridViewProps) {
  return (
    <section className={sectionShellClass}>
      <PageIntro
        eyebrow={eyebrow}
        title={
          <span className="inline-flex items-center gap-2">
            <span>{title}</span>
            <FeatureStatusBadge statusId={statusId} />
          </span>
        }
        description={description}
      />
      <div className="grid grid-cols-3 gap-3.5 max-xl:grid-cols-1">
        {cards.map((card) => {
          const Icon = card.icon ?? Wrench;
          return (
            <FeatureCardButton
              key={card.title}
              icon={Icon}
              title={
                <span className="inline-flex items-center gap-2">
                  <span>{card.title}</span>
                  <FeatureStatusBadge statusId={statusId} />
                </span>
              }
              description={card.description}
              onClick={() => onAction(action, { title: card.title })}
            />
          );
        })}
      </div>
      <div className="truncate text-[13px] text-[color:var(--muted-2)]">
        Primary stub action: <code>{action}</code>
      </div>
    </section>
  );
}
