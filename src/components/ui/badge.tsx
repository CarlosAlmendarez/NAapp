import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        accent: "border-transparent bg-accent text-accent-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
        // Un color por tipo de casilla (Básica/Contigua/Especial/
        // Extraordinaria) — ver formatTipoCasilla/varianteTipoCasilla en
        // src/lib/tipo-casilla.ts.
        "tipo-basica": "border-transparent bg-tipo-basica text-tipo-basica-foreground",
        "tipo-contigua": "border-transparent bg-tipo-contigua text-tipo-contigua-foreground",
        "tipo-especial": "border-transparent bg-tipo-especial text-tipo-especial-foreground",
        "tipo-extraordinaria":
          "border-transparent bg-tipo-extraordinaria text-tipo-extraordinaria-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
