import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ variant = 'primary', size = 'medium', className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
          'backdrop-blur-xl backdrop-saturate-150 border transition-all duration-200',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variant === 'primary' && 'bg-blue-500/80 hover:bg-blue-500/90 border-blue-400/30 text-white shadow-md',
          variant === 'secondary' && 'bg-white/70 hover:bg-white/80 border-white/20 text-slate-900 shadow-sm',
          size === 'small' && 'px-3 py-1.5 text-xs',
          size === 'medium' && 'px-4 py-2 text-sm',
          size === 'large' && 'px-6 py-3 text-base',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';
