import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'standard' | 'intense';
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant = 'standard', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border backdrop-blur-xl backdrop-saturate-150 transition-all duration-200',
          variant === 'standard' && 'bg-white/70 border-white/20 shadow-sm',
          variant === 'intense' && 'bg-white/60 backdrop-blur-2xl border-white/30 shadow-lg',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
