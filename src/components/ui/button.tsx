import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-white shadow-glow hover:shadow-[0_0_60px_rgba(100,50,255,0.6)] hover:scale-[1.02] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-soft hover:shadow-medium",
        outline: "border-2 border-primary/50 bg-primary/5 text-primary backdrop-blur-sm hover:bg-primary hover:text-white hover:border-primary shadow-soft hover:shadow-glow hover:scale-[1.02]",
        secondary: "bg-secondary/80 backdrop-blur-sm text-secondary-foreground border border-border hover:bg-secondary shadow-soft hover:shadow-medium hover:scale-[1.02]",
        ghost: "text-foreground hover:bg-accent/50 hover:text-accent-foreground backdrop-blur-sm",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "bg-gradient-to-br from-primary via-primary-light to-primary-glow text-white shadow-glow hover:shadow-[0_0_80px_rgba(100,50,255,0.8)] hover:scale-[1.05] animate-glow-pulse",
      },
      size: {
        default: "h-12 px-8 py-3",
        sm: "h-10 rounded-xl px-5",
        lg: "h-16 rounded-2xl px-12 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
