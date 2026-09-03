import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-default)] px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-11";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:brightness-110",
  secondary: "bg-surface text-foreground border border-border hover:bg-border/40",
  ghost: "text-foreground hover:bg-surface",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ className = "", variant = "primary", ...props }, ref) {
  return (
    <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
});
