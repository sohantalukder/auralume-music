import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "app-button inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "app-button-primary bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_10px_30px_color-mix(in_srgb,var(--accent)_28%,transparent)] hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]",
        secondary: "app-button-secondary border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-elevated)]",
        ghost: "app-button-ghost text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]",
        danger: "app-button-danger bg-red-500/12 text-red-400 hover:bg-red-500/20",
      },
      size: { default: "app-button-default h-10 px-5", sm: "app-button-sm h-8 px-3 text-xs", icon: "app-button-icon size-10 p-0" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
