import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiError, ApiSuccess, DispatchedIssue } from '@ones-ai-workflow/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/date-time';
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ExternalLinkIcon, FileTextIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type DispatchedIssuesResponse = ApiSuccess<DispatchedIssue[]> | ApiError;
type DeleteDispatchedIssueResponse = ApiSuccess<true> | ApiError;

function formatExecutionStatus(
  value: DispatchedIssue['latestExecutionStatus'],
  t: (key: string) => string
): string {
  if (!value) {
    return t('common.fallback.emptyValue');
  }

  const statusMap: Record<NonNullable<DispatchedIssue['latestExecutionStatus']>, string> = {
    created: t('pages.issues.status.created'),
    executing: t('pages.issues.status.executing'),
    success: t('pages.issues.status.success'),
    failure: t('pages.issues.status.failure'),
    blocked: t('pages.issues.status.blocked')
  };

  return statusMap[value];
}

export function IssuesPage() {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
  const navigate = useNavigate();
  const [issues, setIssues] = useState<DispatchedIssue[]>([]);
  const [pendingDeleteIssue, setPendingDeleteIssue] = useState<DispatchedIssue | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingIssueUUID, setIsDeletingIssueUUID] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadIssues() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/executions/issues');
      const payload = (await response.json()) as DispatchedIssuesResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.issues.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.issues.loadFailed')
        );
      }

      setIssues(payload.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t, 'pages.issues.loadFailed'));
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadIssues();
  }, []);

  async function handleDeleteIssue() {
    if (!pendingDeleteIssue) {
      return;
    }

    try {
      const deletingIssue = pendingDeleteIssue;
      setIsDeletingIssueUUID(deletingIssue.uuid);

      const response = await fetch(`/api/executions/issues/${deletingIssue.uuid}`, {
        method: 'DELETE'
      });
      const payload = (await response.json()) as DeleteDispatchedIssueResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.issues.deleteFailed')
            : getApiErrorMessage(payload, t, 'pages.issues.deleteFailed')
        );
      }

      setPendingDeleteIssue(null);
      setIssues((currentIssues) =>
        currentIssues.filter((issue) => issue.uuid !== deletingIssue.uuid)
      );
      toast.success(t('pages.issues.deleteSuccess'));
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.issues.deleteFailed'));
    } finally {
      setIsDeletingIssueUUID(null);
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="overflow-hidden rounded-lg border">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-28 px-4">{t('pages.issues.table.displayId')}</TableHead>
                <TableHead className="w-[36%]">{t('pages.issues.table.title')}</TableHead>
                <TableHead className="w-40">{t('pages.issues.table.project')}</TableHead>
                <TableHead className="w-32">{t('pages.issues.table.issueType')}</TableHead>
                <TableHead className="w-32">
                  {t('pages.issues.table.latestExecutionStatus')}
                </TableHead>
                <TableHead className="w-44">{t('pages.issues.table.lastDispatchedAt')}</TableHead>
                <TableHead className="w-52 pr-4 text-right">
                  {t('pages.issues.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('common.states.loading')}
                  </TableCell>
                </TableRow>
              ) : errorMessage ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 px-4 text-center text-destructive"
                  >
                    {errorMessage}
                  </TableCell>
                </TableRow>
              ) : issues.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 px-4 text-center text-muted-foreground"
                  >
                    {t('pages.issues.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                issues.map((issue) => (
                  <TableRow key={issue.uuid}>
                    <TableCell className="px-4 font-medium">
                      {issue.displayId || t('common.fallback.emptyValue')}
                    </TableCell>
                    <TableCell className="max-w-0">
                      {issue.onesURL ? (
                        <a
                          href={issue.onesURL}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 items-center gap-1 text-foreground transition-colors hover:text-primary hover:underline underline-offset-4"
                          title={issue.name}
                        >
                          <span className="truncate">{issue.name}</span>
                          <ExternalLinkIcon className="size-3.5 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <span className="block truncate text-foreground" title={issue.name}>
                          {issue.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{issue.project.name}</TableCell>
                    <TableCell>{issue.issueType.name}</TableCell>
                    <TableCell>{formatExecutionStatus(issue.latestExecutionStatus, t)}</TableCell>
                    <TableCell>
                      {formatDateTime(issue.lastDispatchedAt, locale)}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/settings/issues/${issue.uuid}`)}
                        >
                          <FileTextIcon />
                          {t('pages.issues.actions.history')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isDeletingIssueUUID === issue.uuid}
                          onClick={() => setPendingDeleteIssue(issue)}
                        >
                          <Trash2Icon />
                          {isDeletingIssueUUID === issue.uuid
                            ? t('common.states.deleting')
                            : t('pages.issues.actions.delete')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog
        open={pendingDeleteIssue !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingIssueUUID) {
            setPendingDeleteIssue(null);
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.issues.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteIssue
                ? t('pages.issues.deleteDialog.descriptionWithIssue', {
                    name: pendingDeleteIssue.displayId || pendingDeleteIssue.name
                  })
                : t('pages.issues.deleteDialog.descriptionFallback')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(isDeletingIssueUUID)}>
              {t('common.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(isDeletingIssueUUID)}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteIssue();
              }}
            >
              {isDeletingIssueUUID
                ? t('common.states.deleting')
                : t('common.actions.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
