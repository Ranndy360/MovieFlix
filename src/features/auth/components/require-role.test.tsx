import { render, screen } from '@testing-library/react';

import { useAuthStore } from '@/store/auth.store';
import { buildAdmin, buildUser } from '@/testing/factories/auth.factory';
import { RequireRole } from './require-role';

describe('RequireRole', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'idle', error: null });
  });

  it('renders children for a matching role', () => {
    useAuthStore.setState({ user: buildAdmin(), status: 'authenticated' });

    render(
      <RequireRole roles={['ADMIN']}>
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('treats multiple roles as OR', () => {
    useAuthStore.setState({ user: buildUser('PROVIDER'), status: 'authenticated' });

    render(
      <RequireRole roles={['ADMIN', 'PROVIDER']}>
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('renders nothing for a non-matching role', () => {
    useAuthStore.setState({ user: buildUser('USER'), status: 'authenticated' });

    render(
      <RequireRole roles={['ADMIN']}>
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders the fallback instead when provided', () => {
    useAuthStore.setState({ user: buildUser('USER'), status: 'authenticated' });

    render(
      <RequireRole roles={['ADMIN']} fallback={<span>denied</span>}>
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.getByText('denied')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('shows the pending slot while the session is unresolved', () => {
    useAuthStore.setState({ user: null, status: 'loading' });

    render(
      <RequireRole roles={['ADMIN']} pending={<span>checking</span>} fallback={<span>denied</span>}>
        <span>secret</span>
      </RequireRole>,
    );

    // Critically NOT the fallback: showing "denied" before we know would flash
    // a wrong state for every admin on every reload.
    expect(screen.getByText('checking')).toBeInTheDocument();
    expect(screen.queryByText('denied')).not.toBeInTheDocument();
  });

  it('hides children from an anonymous visitor', () => {
    useAuthStore.setState({ user: null, status: 'unauthenticated' });

    render(
      <RequireRole roles={['USER']}>
        <span>secret</span>
      </RequireRole>,
    );

    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
