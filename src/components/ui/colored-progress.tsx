import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

interface ColoredProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'default';
}

const ColoredProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ColoredProgressProps
>(({ className, value, color = 'default', ...props }, ref) => {
  // Define color classes based on the color prop
  const colorClasses = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    default: 'bg-primary'
  };

  return (
    <ProgressPrimitive.Root 
      ref={ref} 
      className={cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', className)} 
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full flex-1 transition-all', colorClasses[color])}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});

ColoredProgress.displayName = 'ColoredProgress';

export { ColoredProgress };