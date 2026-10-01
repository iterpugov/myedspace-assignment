import { Link, type LinkProps } from 'react-router';

/** The `link` button variant: blue text, used for "Back" and other secondary navigation. */
export function TextLink({ className = '', ...props }: LinkProps) {
  return (
    <Link
      className={`type-label inline-flex min-h-11 items-center text-brand outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand ${className}`}
      {...props}
    />
  );
}
