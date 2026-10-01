import { useId, type SelectHTMLAttributes } from 'react';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  hint?: string;
}

export function Select({ label, hint, className = '', children, ...props }: SelectProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={`flex max-w-form flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="type-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-describedby={hint ? hintId : undefined}
          className="type-body h-12 w-full appearance-none rounded-none border border-line bg-surface pr-12 pl-4 text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-disabled disabled:text-ink/50"
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 8"
          className="pointer-events-none absolute top-1/2 right-4 h-2 w-3 -translate-y-1/2 fill-none stroke-ink stroke-2"
        >
          <path d="M1 1l5 5 5-5" />
        </svg>
      </div>
      {hint && (
        <p id={hintId} className="type-small text-ink/70">
          {hint}
        </p>
      )}
    </div>
  );
}
