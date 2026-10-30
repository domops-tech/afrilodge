import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-default)] px-5 py-2.5 text-[.9375rem] font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-11";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "bg-transparent text-foreground border border-foreground/25 hover:bg-surface-alt",
  ghost: "text-foreground hover:bg-surface-alt",
};

export function buttonClassName(variant: Variant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`;
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ className = "", variant = "primary", ...props }, ref) {
  return (
    <button ref={ref} className={buttonClassName(variant, className)} {...props} />
  );
});
