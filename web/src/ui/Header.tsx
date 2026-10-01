import { Link, NavLink } from 'react-router';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `type-label inline-flex min-h-11 items-center px-3 outline-offset-2 focus-visible:outline-2 focus-visible:outline-white ${
    isActive ? 'underline underline-offset-8' : 'hover:underline hover:underline-offset-8'
  }`;

export function Header() {
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
            <NavLink to="/" end className={navLinkClass}>
              Courses
            </NavLink>
            <NavLink to="/login" className={navLinkClass}>
              Sign in
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}
