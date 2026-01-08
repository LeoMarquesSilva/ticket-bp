import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#101F2E] text-white hover:bg-[#1a3349]",
        secondary:
          "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200",
        success:
          "border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        warning:
          "border-transparent bg-amber-50 text-amber-700 hover:bg-amber-100",
        danger:
          "border-transparent bg-red-50 text-red-700 hover:bg-red-100",
        outline: 
          "border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        gold:
          "border-transparent bg-[#F9F3E6] text-[#D5B170] hover:bg-[#F5EBD6]",
        gradient:
          "border-transparent bg-responsum-gradient text-white shadow-sm",
      },
      size: {
        default: "h-5 text-xs px-2.5",
        sm: "h-4 text-[10px] px-1.5",
        lg: "h-6 text-sm px-3",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };