import { Notice } from '../ui/Notice';
import { PageShell } from '../ui/PageShell';
import { TextLink } from '../ui/TextLink';

interface PlaceholderPageProps {
  title: string;
  message: string;
}

/** Stands in for a page that a later slice builds, so no link leads to a dead route. */
export function PlaceholderPage({ title, message }: PlaceholderPageProps) {
  return (
    <PageShell>
      <div className="flex max-w-form flex-col gap-6">
        <h1 className="type-heading text-brand">{title}</h1>
        <Notice>{message}</Notice>
        <TextLink to="/">← Back to courses</TextLink>
      </div>
    </PageShell>
  );
}
