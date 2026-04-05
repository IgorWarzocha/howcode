import type { ReactNode } from "react";
import {
  type FeatureStatusId,
  getFeatureStatusBadgeClass,
  getFeatureStatusDataAttributes,
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
      {...getFeatureStatusDataAttributes(statusId)}
    >
      {children ?? getFeatureStatusMeta(statusId).label}
    </span>
  );
}
