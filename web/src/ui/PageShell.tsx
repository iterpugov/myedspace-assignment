import type { ReactNode } from 'react';
import { Header } from './Header';

interface PageShellProps {
  /** Shown on the brand-blue band under the header; omit for plain white pages. */
  hero?: ReactNode;
  children: ReactNode;
}

export function PageShell({ hero, children }: PageShellProps) {
  return (
    <div className="min-h-screen">
      <Header />
      {hero && (
        <section className="bg-brand text-white">
          <div className="mx-auto max-w-page px-4 pt-8 pb-14 md:px-6 md:pt-16 md:pb-24">{hero}</div>
        </section>
      )}
      <main className="mx-auto max-w-page px-4 py-10 md:px-6 md:py-16">{children}</main>
    </div>
  );
}
