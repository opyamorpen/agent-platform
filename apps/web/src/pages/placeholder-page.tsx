import { useTranslation } from 'react-i18next';

type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  const { t } = useTranslation();
  return (
    <div className="@container/main flex flex-1 flex-col gap-2 p-4 md:p-6">
      <div className="flex min-h-full flex-1 items-center justify-center rounded-2xl border border-dashed border-border bg-card">
        <div className="px-6 py-10 text-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('pages.placeholder.description')}
          </p>
        </div>
      </div>
    </div>
  );
}
