import type { ReactNode } from 'react';
import { Link, NavLink, type NavLinkProps } from 'react-router';

const navItemClass =
  'type-label inline-flex min-h-11 items-center px-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-white';

/** A link in the header navigation; underlined while its route is open. */
export function HeaderLink(props: Omit<NavLinkProps, 'className'>) {
  return (
    <NavLink
      className={({ isActive }) =>
        `${navItemClass} ${isActive ? 'underline underline-offset-8' : 'hover:underline hover:underline-offset-8'}`
      }
      {...props}
    />
  );
}

/** An action in the header navigation that is not a page, e.g. "Sign out". */
export function HeaderButton({ children, ...props }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`${navItemClass} hover:underline hover:underline-offset-8 disabled:cursor-not-allowed disabled:opacity-60`}
      {...props}
    >
      {children}
    </button>
  );
}

interface HeaderProps {
  /** Replaces the public links; the LMS passes its own (see RequireSession). */
  nav?: ReactNode;
}

export function Header({ nav }: HeaderProps) {
  return (
    <header className="bg-brand text-white">
      <div className="mx-auto max-w-page px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border border-line-brand/40 px-4 py-2">
          <Link
            to="/"
            className="type-subheading font-bold outline-offset-2 focus-visible:outline-2 focus-visible:outline-white"
          >
            MyEdSpace <span className="type-small font-normal opacity-80">mock</span>
          </Link>
          <nav aria-label="Main" className="flex flex-wrap items-center gap-x-2">
            {nav ?? (
              <>
                <HeaderLink to="/" end>
                  Courses
                </HeaderLink>
                <HeaderLink to="/login">Sign in</HeaderLink>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
