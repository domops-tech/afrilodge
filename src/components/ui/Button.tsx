import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 px-6 text-[0.6875rem] font-medium uppercase tracking-[.14em] transition-colors disabled:opacity-50 disabled:pointer-events-none min-h-11";

const variants: Record<Variant, string> = {
  primary: "bg-foreground text-background hover:bg-accent",
  secondary: "border border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background",
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
