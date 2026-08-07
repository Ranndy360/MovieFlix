'use client';

import { useState } from 'react';

import { CollapsiblePanel } from '@/components/ui/collapsible-panel';
import { FeedbackMessage } from '@/components/ui/feedback-message';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { UserAdminTable } from '@/features/users/components/user-admin-table';
import { UserForm } from '@/features/users/components/user-form';
import { ROLE_LABELS } from '@/types/auth';

/**
 * ADMIN-only user administration.
 *
 * `useRequireAuth` handles the redirect for a signed-out or under-privileged
 * visitor, but that is only UX — every request the table makes is
 * independently authorized by the API.
 */
export default function AdminUsersPage(): React.JSX.Element {
  const { isAllowed, isPending } = useRequireAuth(['ADMIN']);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);

  if (isPending || !isAllowed) {
    return <div aria-busy="true" aria-label="Checking permissions" className="h-48 animate-pulse rounded-sm bg-surface-2" />;
  }

  return (
    <section className="space-y-6 px-4 pb-16 pt-24 md:px-12 md:pt-28">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-content-muted">
          Assign roles and enable or disable accounts. This is the only way to grant the ADMIN or
          PROVIDER role — signup always creates a USER.
        </p>
      </header>

      {notice ? (
        <FeedbackMessage tone="success" title={notice.title} onDismiss={() => setNotice(null)}>
          {notice.body}
        </FeedbackMessage>
      ) : null}

      <CollapsiblePanel
        id="user-form"
        open={isFormOpen}
        onToggle={() => setIsFormOpen((open) => !open)}
        openLabel="Add user"
        title="Registered users"
      >
        <UserForm
          onCreated={(user) => {
            setIsFormOpen(false);
            setRefreshToken((token) => token + 1);
            setNotice({
              title: `${user.fullName} can sign in now`,
              body: `The account is active with the ${ROLE_LABELS[user.role]} role. Share the password you set — they can change it later.`,
            });
          }}
          onCancel={() => setIsFormOpen(false)}
        />
      </CollapsiblePanel>

      <UserAdminTable refreshToken={refreshToken} />
    </section>
  );
}
