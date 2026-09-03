import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-default)] border border-border bg-surface p-4 ${className}`}
      {...props}
    />
  );
}
