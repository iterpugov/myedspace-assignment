import type { ReactNode } from 'react';

interface CardProps {
  /** Small line above the content, e.g. "Your order". */
  label?: string;
  children: ReactNode;
}

export function Card({ label, children }: CardProps) {
  return (
    <div className="notch-lg flex flex-col gap-2 bg-surface-tint p-6 md:p-8">
      {label && <p className="type-label text-ink/70">{label}</p>}
      {children}
    </div>
  );
}
