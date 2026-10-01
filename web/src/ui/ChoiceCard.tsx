import type { ReactNode } from 'react';

interface ChoiceCardProps {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  children: ReactNode;
}

/** A Card that is one option of a radio group; the whole card is the click target. */
export function ChoiceCard({ name, value, checked, onSelect, children }: ChoiceCardProps) {
  return (
    <label className="notch-lg flex min-h-11 cursor-pointer items-start gap-4 bg-surface-tint p-6 has-checked:bg-brand has-checked:text-white has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-ink has-checked:has-focus-visible:outline-white md:p-8">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="mt-1 size-5 shrink-0 accent-accent outline-none"
      />
      <span className="flex flex-col gap-1">{children}</span>
    </label>
  );
}
