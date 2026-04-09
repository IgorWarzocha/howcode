import type { PropsWithChildren } from "react";
import { emptyStateCardClass } from "../../ui/classes";
import { cn } from "../../utils/cn";

type EmptyStateCardProps = PropsWithChildren<{
  className?: string;
}>;

export function EmptyStateCard({ children, className }: EmptyStateCardProps) {
  return <div className={cn(emptyStateCardClass, className)}>{children}</div>;
}
