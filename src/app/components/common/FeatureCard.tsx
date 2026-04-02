import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { featureCardClass } from "../../ui/classes";

type FeatureCardProps = {
  icon: LucideIcon;
  title: ReactNode;
  description: string;
  onClick: () => void;
};

export function FeatureCard({ icon: Icon, title, description, onClick }: FeatureCardProps) {
  return (
    <button type="button" className={featureCardClass} onClick={onClick}>
      <Icon size={18} />
      <div>
        <h3 className="mb-1.5 text-lg">{title}</h3>
        <p className="m-0 whitespace-normal leading-[1.5] text-[color:var(--muted)]">
          {description}
        </p>
      </div>
    </button>
  );
}
