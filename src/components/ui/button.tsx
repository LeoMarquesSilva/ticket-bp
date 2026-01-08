import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F69F19]/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[#F69F19] text-[#2C2D2F] hover:bg-[#F69F19]/90 hover:shadow-sm',
        destructive: 'bg-[#BD2D29] text-[#F6F6F6] hover:bg-[#BD2D29]/90 hover:shadow-sm',
        outline: 'border border-[#F69F19] bg-transparent text-[#F69F19] hover:bg-[#F69F19]/10',
        secondary: 'bg-[#DE5532] text-[#F6F6F6] hover:bg-[#DE5532]/90 hover:shadow-sm',
        ghost: 'hover:bg-[#F69F19]/10 hover:text-[#F69F19]',
        link: 'text-[#DE5532] underline-offset-4 hover:underline',
        gradient: 'bg-gradient-to-r from-[#2C2D2F] to-[#F6F6F6]/20 text-[#F6F6F6] hover:opacity-90',
        dark: 'bg-[#2C2D2F] text-[#F6F6F6] hover:bg-[#2C2D2F]/90 hover:shadow-sm',
        light: 'bg-[#F6F6F6] text-[#2C2D2F] border border-[#2C2D2F]/10 hover:bg-white hover:shadow-sm',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        xl: 'h-12 rounded-md px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };