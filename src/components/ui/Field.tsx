import { type InputHTMLAttributes, forwardRef, useId } from "react";

export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }
>(function Field({ label, error, id, className = "", ...props }, ref) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <label className="caps !text-[.625rem] text-muted" htmlFor={fieldId}>{label}</label>
      <input
        ref={ref}
        id={fieldId}
        className={`min-h-11 rounded-[var(--radius-sm)] border border-foreground/30 bg-background px-3.5 py-2.5 text-base text-foreground outline-none placeholder:text-muted/80 focus:border-foreground ${className}`}
        {...props}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={[props["aria-describedby"], error ? errorId : undefined].filter(Boolean).join(" ") || undefined}
      />
      {error ? <span id={errorId} role="alert" className="text-danger text-xs">{error}</span> : null}
    </div>
  );
});
