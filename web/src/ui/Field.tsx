import { useId, type InputHTMLAttributes, type Ref } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Shown under the input and announced as its description. */
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Field({ label, error, className = '', ...props }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`flex max-w-form flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="type-label">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`type-body h-12 w-full rounded-none border bg-surface px-4 text-ink focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand ${
          error ? 'border-danger' : 'border-line'
        }`}
        {...props}
      />
      {error && (
        <p id={errorId} className="type-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
