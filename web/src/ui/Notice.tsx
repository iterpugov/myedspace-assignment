import type { ReactNode } from 'react';

interface NoticeProps {
  variant?: 'info' | 'error';
  /** Announce an info notice when it appears (e.g. "Loading…"). Errors are always announced. */
  live?: boolean;
  children: ReactNode;
}

export function Notice({ variant = 'info', live = false, children }: NoticeProps) {
  const isError = variant === 'error';
  return (
    <div
      role={isError ? 'alert' : live ? 'status' : undefined}
      className={`type-body border-l-4 bg-surface-tint p-4 ${isError ? 'border-danger' : 'border-brand'}`}
    >
      {children}
    </div>
  );
}
