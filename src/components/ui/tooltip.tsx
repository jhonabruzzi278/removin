import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg shadow-lg whitespace-nowrap animate-in fade-in-0 zoom-in-95',
            positions[position]
          )}
        >
          {content}
          <div
            className={cn(
              'absolute w-2 h-2 bg-slate-900 transform rotate-45',
              position === 'top' && '-bottom-1 left-1/2 -translate-x-1/2',
              position === 'bottom' && '-top-1 left-1/2 -translate-x-1/2',
              position === 'left' && '-right-1 top-1/2 -translate-y-1/2',
              position === 'right' && '-left-1 top-1/2 -translate-y-1/2'
            )}
          />
        </div>
      )}
    </div>
  );
}
