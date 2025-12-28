import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        // Category badges
        actions: "border-transparent bg-primary/10 text-primary",
        forms: "border-transparent bg-[hsl(262_83%_58%_/_0.1)] text-[hsl(262_83%_58%)]",
        content: "border-transparent bg-success/10 text-success",
        unknown: "border-transparent bg-muted text-muted-foreground",
        // Status badges - solid backgrounds with high contrast text
        canonical: "border-transparent bg-success text-white",
        variant: "border-transparent bg-primary text-primary-foreground",
        deviation: "border-transparent bg-warning text-white",
        legacy: "border-transparent bg-muted-foreground text-white",
        experimental: "border-transparent bg-[hsl(262_83%_58%)] text-white",
        unreviewed: "border-border bg-background text-muted-foreground",
        warning: "border-transparent bg-warning text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
