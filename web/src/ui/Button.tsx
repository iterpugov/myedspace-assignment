import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Primary action: lime, notched. The focus ring is inset because the notch clips outside the box. */
export function Button({ className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`notch-sm type-label min-h-14 w-full bg-accent px-8 text-ink -outline-offset-4 enabled:hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:bg-disabled disabled:text-ink/50 sm:w-auto ${className}`}
      {...props}
    />
  );
}
