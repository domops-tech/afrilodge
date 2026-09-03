import { type InputHTMLAttributes, forwardRef } from "react";

export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
>(function Field({ label, error, id, className = "", ...props }, ref) {
  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={id}>
      <span className="font-medium text-foreground">{label}</span>
      <input
        ref={ref}
        id={id}
        className={`min-h-11 rounded-[var(--radius-default)] border border-border bg-background px-3.5 py-2.5 text-base text-foreground outline-none focus:border-accent ${className}`}
        {...props}
      />
      {error ? <span className="text-danger text-xs">{error}</span> : null}
    </label>
  );
});
