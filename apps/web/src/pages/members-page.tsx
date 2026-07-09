import { useEffect, useMemo, useState } from 'react';
import type {
  ApiError,
  ApiSuccess,
  AppMember,
  OnesUserSummary
} from '@ones-ai-workflow/shared';
import { getApiErrorMessage, getErrorMessage } from '@/lib/api-error';
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
import { formatDateTime } from '@/lib/date-time';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/locale';
import { SearchSelect } from '@/components/ui/search-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type MembersResponse = ApiSuccess<AppMember[]> | ApiError;
type MemberResponse = ApiSuccess<AppMember> | ApiError;
type UserSearchResponse = ApiSuccess<OnesUserSummary[]> | ApiError;
type MemberFormState = {
  userUUID: string;
  name: string;
  email: string | null;
  staffID: string | null;
};

const DEFAULT_FORM_STATE: MemberFormState = {
  userUUID: '',
  name: '',
  email: null,
  staffID: null
};

function formatUserLabel(user: Pick<OnesUserSummary, 'name' | 'email' | 'staffID'>): string {
  const suffixes = [user.email, user.staffID].filter(Boolean);

  if (suffixes.length === 0) {
    return user.name;
  }

  return `${user.name} (${suffixes.join(' / ')})`;
}

export function MembersPage() {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
  const [members, setMembers] = useState<AppMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<MemberFormState>(DEFAULT_FORM_STATE);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<OnesUserSummary[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [pendingDeleteMember, setPendingDeleteMember] = useState<AppMember | null>(null);
  const [deletingUserUUID, setDeletingUserUUID] = useState<string | null>(null);

  const existingMemberUUIDs = useMemo(
    () => new Set(members.map((member) => member.userUUID)),
    [members]
  );
  const selectedUserOption = useMemo(() => {
    if (!formData.userUUID || !formData.name) {
      return null;
    }

    return {
      value: formData.userUUID,
      label: formatUserLabel(formData),
      keywords: [formData.email ?? '', formData.staffID ?? ''],
      disabled: false
    };
  }, [formData]);
  const userOptions = useMemo(() => {
    const baseOptions = userSearchResults.map((user) => ({
      value: user.uuid,
      label: formatUserLabel(user),
      keywords: [user.email ?? '', user.staffID ?? ''],
      disabled: existingMemberUUIDs.has(user.uuid)
    }));

    if (
      selectedUserOption &&
      !baseOptions.some((option) => option.value === selectedUserOption.value)
    ) {
      baseOptions.unshift(selectedUserOption);
    }

    return baseOptions;
  }, [existingMemberUUIDs, selectedUserOption, userSearchResults]);

  async function loadMembers() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/members');
      const payload = (await response.json()) as MembersResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.members.loadFailed')
            : getApiErrorMessage(payload, t, 'pages.members.loadFailed')
        );
      }

      setMembers(payload.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t, 'pages.members.loadFailed'));
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearchingUsers(true);

      try {
        const query = new URLSearchParams({
          limit: '20'
        });

        if (searchKeyword.trim()) {
          query.set('keyword', searchKeyword.trim());
        }

        const response = await fetch(`/api/ones/users/search?${query.toString()}`);
        const payload = (await response.json()) as UserSearchResponse;

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.success
              ? t('pages.members.searchFailed')
              : getApiErrorMessage(payload, t, 'pages.members.searchFailed')
          );
        }

        if (cancelled) {
          return;
        }

        setUserSearchResults(payload.data);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFormError(getErrorMessage(error, t, 'pages.members.searchFailed'));
        setUserSearchResults([]);
      } finally {
        if (!cancelled) {
          setIsSearchingUsers(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isDialogOpen, searchKeyword]);

  function resetForm() {
    setFormData(DEFAULT_FORM_STATE);
    setFormError(null);
    setSearchKeyword('');
    setUserSearchResults([]);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    setIsDialogOpen(nextOpen);

    if (!nextOpen) {
      resetForm();
    }
  }

  function upsertMember(nextMember: AppMember) {
    setMembers((currentMembers) => {
      const exists = currentMembers.some(
        (member) => member.userUUID === nextMember.userUUID
      );

      if (!exists) {
        return [...currentMembers, nextMember];
      }

      return currentMembers.map((member) =>
        member.userUUID === nextMember.userUUID ? nextMember : member
      );
    });
  }

  function removeMember(userUUID: string) {
    setMembers((currentMembers) =>
      currentMembers.filter((member) => member.userUUID !== userUUID)
    );
  }

  async function handleSubmit() {
    if (!formData.userUUID || !formData.name) {
      setFormError(t('pages.members.selectUserRequired'));
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const response = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const payload = (await response.json()) as MemberResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.members.addFailed')
            : getApiErrorMessage(payload, t, 'pages.members.addFailed')
        );
      }

      upsertMember(payload.data);
      setIsDialogOpen(false);
      resetForm();
      toast.success(t('pages.members.addSuccess', { name: payload.data.name }));
    } catch (error) {
      const message = getErrorMessage(error, t, 'pages.members.addFailed');
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteMember() {
    if (!pendingDeleteMember) {
      return;
    }

    try {
      setDeletingUserUUID(pendingDeleteMember.userUUID);

      const response = await fetch(`/api/members/${pendingDeleteMember.userUUID}`, {
        method: 'DELETE'
      });
      const payload = (await response.json()) as ApiSuccess<true> | ApiError;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success
            ? t('pages.members.removeFailed')
            : getApiErrorMessage(payload, t, 'pages.members.removeFailed')
        );
      }

      removeMember(pendingDeleteMember.userUUID);
      toast.success(t('pages.members.removeSuccess', { name: pendingDeleteMember.name }));
      setPendingDeleteMember(null);
    } catch (error) {
      toast.error(getErrorMessage(error, t, 'pages.members.removeFailed'));
    } finally {
      setDeletingUserUUID(null);
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="relative flex flex-1 flex-col gap-4 overflow-auto px-4 py-4 lg:px-6 md:py-6">
        <div className="flex items-center justify-start">
          <Button type="button" size="sm" onClick={() => setIsDialogOpen(true)}>
            <PlusIcon className="mr-1 size-4" />
            {t('pages.members.actions.add')}
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="px-4">{t('pages.members.table.name')}</TableHead>
                <TableHead>{t('pages.members.table.email')}</TableHead>
                <TableHead>{t('pages.members.table.userUuid')}</TableHead>
                <TableHead>{t('pages.members.table.createdAt')}</TableHead>
                <TableHead className="pr-4 text-right">
                  {t('pages.members.table.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 px-4 text-center text-muted-foreground">
                    {t('common.states.loading')}
                  </TableCell>
                </TableRow>
              ) : errorMessage ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 px-4 text-center text-destructive">
                    {errorMessage}
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 px-4 text-center text-muted-foreground">
                    {t('pages.members.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.userUUID}>
                    <TableCell className="px-4 font-medium">{member.name}</TableCell>
                    <TableCell>{member.email ?? t('common.fallback.emptyValue')}</TableCell>
                    <TableCell>{member.userUUID}</TableCell>
                    <TableCell>{formatDateTime(member.createdAt, locale)}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingDeleteMember(member)}
                          disabled={deletingUserUUID === member.userUUID}
                        >
                          <Trash2Icon />
                          {t('pages.members.actions.remove')}
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

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pages.members.dialog.title')}</DialogTitle>
            <DialogDescription>{t('pages.members.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                {t('pages.members.dialog.userLabel')}
              </div>
              <SearchSelect
                options={userOptions}
                value={formData.userUUID || undefined}
                placeholder={
                  isSearchingUsers
                    ? t('pages.members.dialog.searchPlaceholderLoading')
                    : t('pages.members.dialog.searchPlaceholder')
                }
                emptyText={
                  isSearchingUsers
                    ? t('pages.members.dialog.searchEmptyLoading')
                    : t('pages.members.dialog.searchEmpty')
                }
                disabled={isSubmitting}
                onInputValueChange={(value) => {
                  setSearchKeyword(value);
                  setFormError(null);
                }}
                onValueChange={(value) => {
                  const nextUser =
                    userSearchResults.find((user) => user.uuid === value) ?? null;

                  if (!nextUser) {
                    setFormData(DEFAULT_FORM_STATE);
                    return;
                  }

                  setFormData({
                    userUUID: nextUser.uuid,
                    name: nextUser.name,
                    email: nextUser.email ?? null,
                    staffID: nextUser.staffID ?? null
                  });
                  setFormError(null);
                }}
              />
            </div>

            {formData.userUUID ? (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <div>
                  {t('pages.members.dialog.selectedName', {
                    value: formData.name
                  })}
                </div>
                <div>
                  {t('pages.members.dialog.selectedEmail', {
                    value: formData.email ?? t('common.fallback.emptyValue')
                  })}
                </div>
                <div>
                  {t('pages.members.dialog.selectedStaffId', {
                    value: formData.staffID ?? t('common.fallback.emptyValue')
                  })}
                </div>
              </div>
            ) : null}

            {formError ? (
              <div className="text-sm text-destructive">{formError}</div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting
                ? t('pages.members.actions.adding')
                : t('pages.members.actions.confirmAdd')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteMember)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteMember(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.members.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.members.deleteDialog.description', {
                name: pendingDeleteMember?.name ?? ''
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingUserUUID)}>
              {t('common.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteMember();
              }}
              disabled={Boolean(deletingUserUUID)}
            >
              {deletingUserUUID
                ? t('pages.members.actions.removing')
                : t('pages.members.actions.confirmRemove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
