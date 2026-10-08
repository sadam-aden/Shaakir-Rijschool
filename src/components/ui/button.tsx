import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white shadow-sm hover:bg-primary-600",
        outline: "border border-line bg-card text-ink hover:bg-primary-faint",
        soft: "border border-primary/25 bg-card text-primary hover:bg-primary-faint",
        dark: "bg-exam text-white hover:opacity-90",
        ghost: "text-muted hover:bg-page hover:text-ink",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className, variant, size, asChild, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
