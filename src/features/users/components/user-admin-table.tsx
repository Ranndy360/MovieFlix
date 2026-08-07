'use client';

import { useCallback, useEffect, useState } from 'react';

import { FeedbackMessage } from '@/components/ui/feedback-message';
import { Pagination } from '@/components/ui/pagination';
import { SearchInput } from '@/components/ui/search-input';
import { isApiError } from '@/lib/api';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useAuthUser } from '@/store/auth.store';
import type { PaginationMeta } from '@/types/api';
import type { AuthUser, Role } from '@/types/auth';
import { ROLES, ROLE_LABELS } from '@/types/auth';
import { listUsers, updateUserRole, updateUserStatus } from '../api/users.api';

export interface UserAdminTableProps {
  /** Bumped by the parent after a create so the list refetches. */
  refreshToken?: number;
}

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'active' | 'disabled';

interface Criteria {
  search: string;
  role: Role | 'all';
  status: StatusFilter;
  page: number;
}

const INITIAL: Criteria = { search: '', role: 'all', status: 'all', page: 1 };

const SELECT_CLASS =
  'rounded-sm border border-line bg-surface-2 px-3 py-2 text-sm text-white focus:border-white';

export function UserAdminTable({ refreshToken = 0 }: UserAdminTableProps): React.JSX.Element {
  const currentUser = useAuthUser();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [typedSearch, setTypedSearch] = useState('');
  const debouncedSearch = useDebouncedValue(typedSearch);
  const [criteria, setCriteria] = useState<Criteria>(INITIAL);

  // Page reset happens in the same update as the new search text — see the
  // note in MovieAdminTable for why splitting them costs an extra request.
  useEffect(() => {
    setCriteria((current) =>
      current.search === debouncedSearch
        ? current
        : { ...current, search: debouncedSearch, page: 1 },
    );
  }, [debouncedSearch]);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);

      try {
        const page = await listUsers(
          {
            page: criteria.page,
            pageSize: PAGE_SIZE,
            ...(criteria.search ? { search: criteria.search } : {}),
            ...(criteria.role !== 'all' ? { role: criteria.role } : {}),
            ...(criteria.status !== 'all' ? { isActive: criteria.status === 'active' } : {}),
          },
          signal ? { signal } : undefined,
        );
        setUsers(page.items);
        setMeta(page.meta);
        setError(null);
      } catch (cause) {
        if (isApiError(cause) && cause.kind === 'aborted') return;
        setError(
          isApiError(cause)
            ? cause.toDisplayMessage()
            : 'We could not load the user list. Refresh the page to try again.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [criteria],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshToken]);

  async function changeRole(user: AuthUser, role: Role): Promise<void> {
    setPendingId(user.id);
    setError(null);

    try {
      const updated = await updateUserRole(user.id, role);
      setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)));
    } catch (cause) {
      setError(
        isApiError(cause)
          ? cause.toDisplayMessage()
          : 'That role change did not go through, so the account is unchanged. Try again in a moment.',
      );
    } finally {
      setPendingId(null);
    }
  }

  async function toggleActive(user: AuthUser): Promise<void> {
    setPendingId(user.id);
    setError(null);

    try {
      const updated = await updateUserStatus(user.id, !user.isActive);
      setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)));
    } catch (cause) {
      setError(
        isApiError(cause)
          ? cause.toDisplayMessage()
          : 'We could not change that account, so it is unchanged. Try again in a moment.',
      );
    } finally {
      setPendingId(null);
    }
  }

  const isFiltered = criteria.search !== '' || criteria.role !== 'all' || criteria.status !== 'all';

  function clearFilters(): void {
    setTypedSearch('');
    setCriteria(INITIAL);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <FeedbackMessage tone="error" title="Something did not work">
          {error}
        </FeedbackMessage>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          id="user-search"
          label="Search users"
          placeholder="Search by name or email…"
          value={typedSearch}
          onChange={setTypedSearch}
          className="sm:max-w-xs sm:flex-1"
        />

        <label className="sr-only" htmlFor="user-role-filter">
          Filter by role
        </label>
        <select
          id="user-role-filter"
          value={criteria.role}
          onChange={(event) =>
            setCriteria((c) => ({ ...c, role: event.target.value as Role | 'all', page: 1 }))
          }
          className={SELECT_CLASS}
        >
          <option value="all">All roles</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="user-status-filter">
          Filter by status
        </label>
        <select
          id="user-status-filter"
          value={criteria.status}
          onChange={(event) =>
            setCriteria((c) => ({ ...c, status: event.target.value as StatusFilter, page: 1 }))
          }
          className={SELECT_CLASS}
        >
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>

        {isFiltered ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-sm border border-line-strong px-3 py-2 text-sm font-medium transition-colors hover:border-white"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {meta === null && isLoading ? (
        <div
          aria-busy="true"
          aria-label="Loading users"
          className="h-48 animate-pulse rounded-sm bg-surface-2"
        />
      ) : users.length === 0 ? (
        <div className="space-y-1 rounded-sm border border-dashed border-line px-6 py-12 text-center">
          <p className="font-semibold text-white">
            {isFiltered ? 'No accounts match those filters' : 'There are no accounts yet'}
          </p>
          <p className="text-sm text-content-muted">
            {isFiltered
              ? 'Try another role or status, or clear the filters to see everyone.'
              : 'Use “Add user” above to create the first one.'}
          </p>
        </div>
      ) : (
        <>
          <div
            aria-busy={isLoading}
            className={`overflow-x-auto rounded-sm border border-line transition-opacity ${
              isLoading ? 'opacity-50' : ''
            }`}
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Registered users and their roles</caption>
              <thead className="bg-surface-2 text-xs uppercase text-content-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="px-4 py-3">Role</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  // The API rejects self-demotion and self-deactivation; disabling
                  // the controls here just avoids a pointless failed request.
                  const isSelf = user.id === currentUser?.id;
                  const isBusy = pendingId === user.id;

                  return (
                    <tr key={user.id} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">
                        {user.fullName}
                        {isSelf ? <span className="ml-2 text-xs text-content-muted">(you)</span> : null}
                      </td>
                      <td className="px-4 py-3 text-content-muted">{user.email}</td>
                      <td className="px-4 py-3">
                        <label className="sr-only" htmlFor={`role-${user.id}`}>
                          Role for {user.email}
                        </label>
                        <select
                          id={`role-${user.id}`}
                          value={user.role}
                          disabled={isSelf || isBusy}
                          onChange={(event) => void changeRole(user, event.target.value as Role)}
                          className="rounded-sm border border-line bg-surface-2 px-2 py-1 text-sm disabled:opacity-50"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            user.isActive
                              ? 'rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                              : 'rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-content-muted'
                          }
                        >
                          {user.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={isSelf || isBusy}
                          onClick={() => void toggleActive(user)}
                          className="rounded-sm border border-line-strong px-3 py-1 text-xs font-medium transition-colors hover:border-white disabled:opacity-50"
                        >
                          {user.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {meta ? (
            <Pagination
              meta={meta}
              itemLabel="account"
              isBusy={isLoading}
              onPageChange={(page) => setCriteria((c) => ({ ...c, page }))}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
