import type { ReactNode } from "react";
import {
  type FeatureStatusId,
  getFeatureStatusBadgeClass,
  getFeatureStatusMeta,
} from "../../features/feature-status";

type FeatureStatusBadgeProps = {
  statusId: FeatureStatusId;
  className?: string;
  children?: ReactNode;
};

export function FeatureStatusBadge({ statusId, className, children }: FeatureStatusBadgeProps) {
  return (
    <span
      className={
        className
          ? `${getFeatureStatusBadgeClass(statusId)} ${className}`
          : getFeatureStatusBadgeClass(statusId)
      }
      data-feature-id={statusId}
      data-feature-status={getFeatureStatusMeta(statusId).status}
    >
      {children ?? getFeatureStatusMeta(statusId).label}
    </span>
  );
}
