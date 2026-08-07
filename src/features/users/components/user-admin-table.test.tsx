import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as usersApi from '@/features/users/api/users.api';
import { useAuthStore } from '@/store/auth.store';
import { buildAdmin, buildUser } from '@/testing/factories/auth.factory';
import type { Paginated } from '@/types/api';
import type { AuthUser } from '@/types/auth';
import { UserAdminTable } from './user-admin-table';

jest.mock('@/features/users/api/users.api');

const api = usersApi as jest.Mocked<typeof usersApi>;

const page = (items: AuthUser[], overrides = {}): Paginated<AuthUser> => ({
  items,
  meta: {
    page: 1,
    pageSize: 10,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
    ...overrides,
  },
});

function signInAdmin(): AuthUser {
  const admin = buildAdmin();
  useAuthStore.setState({ user: admin, status: 'authenticated', error: null });
  return admin;
}

describe('UserAdminTable', () => {
  beforeEach(() => {
    signInAdmin();
    api.listUsers.mockResolvedValue(page([]));
  });

  it('lists accounts with their role and status', async () => {
    api.listUsers.mockResolvedValue(
      page([buildUser('PROVIDER'), { ...buildUser(), isActive: false }]),
    );

    render(<UserAdminTable />);

    expect(await screen.findByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('never lets an admin lock themselves out', async () => {
    const admin = signInAdmin();
    api.listUsers.mockResolvedValue(page([admin]));

    render(<UserAdminTable />);

    const row = await screen.findByRole('row', { name: new RegExp(admin.email) });
    expect(within(row).getByRole('button', { name: 'Disable' })).toBeDisabled();
    expect(within(row).getByRole('combobox')).toBeDisabled();
  });

  describe('filtering and paging', () => {
    it('asks for one page at a time', async () => {
      render(<UserAdminTable />);

      await waitFor(() =>
        expect(api.listUsers).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1, pageSize: 10 }),
          expect.anything(),
        ),
      );
    });

    it('debounces the search into a single request', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      render(<UserAdminTable />);
      await act(async () => {});
      const before = api.listUsers.mock.calls.length;

      await user.type(screen.getByLabelText('Search users'), 'grace');
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      expect(api.listUsers.mock.calls.length).toBe(before + 1);
      expect(api.listUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'grace', page: 1 }),
        expect.anything(),
      );
      jest.useRealTimers();
    });

    it('filters by role', async () => {
      const user = userEvent.setup();

      render(<UserAdminTable />);
      await waitFor(() => expect(api.listUsers).toHaveBeenCalled());

      await user.selectOptions(screen.getByLabelText('Filter by role'), 'PROVIDER');

      await waitFor(() =>
        expect(api.listUsers).toHaveBeenLastCalledWith(
          expect.objectContaining({ role: 'PROVIDER' }),
          expect.anything(),
        ),
      );
    });

    it('translates the status filter into isActive', async () => {
      const user = userEvent.setup();

      render(<UserAdminTable />);
      await waitFor(() => expect(api.listUsers).toHaveBeenCalled());

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'disabled');
      await waitFor(() =>
        expect(api.listUsers).toHaveBeenLastCalledWith(
          expect.objectContaining({ isActive: false }),
          expect.anything(),
        ),
      );

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'all');
      await waitFor(() =>
        expect(api.listUsers.mock.calls.at(-1)?.[0]).not.toHaveProperty('isActive'),
      );
    });

    it('goes back to page one whenever a filter changes', async () => {
      const user = userEvent.setup();
      api.listUsers.mockResolvedValue(
        page([buildUser()], { page: 2, totalItems: 30, totalPages: 3, hasNextPage: true, hasPreviousPage: true }),
      );

      render(<UserAdminTable />);

      await user.click(await screen.findByRole('button', { name: 'Next' }));
      await waitFor(() =>
        expect(api.listUsers).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 3 }),
          expect.anything(),
        ),
      );

      await user.selectOptions(screen.getByLabelText('Filter by role'), 'ADMIN');
      await waitFor(() =>
        expect(api.listUsers).toHaveBeenLastCalledWith(
          expect.objectContaining({ role: 'ADMIN', page: 1 }),
          expect.anything(),
        ),
      );
    });

    it('distinguishes an empty filter result from an empty system', async () => {
      const user = userEvent.setup();

      render(<UserAdminTable />);
      expect(await screen.findByText('There are no accounts yet')).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Filter by role'), 'ADMIN');

      expect(await screen.findByText('No accounts match those filters')).toBeInTheDocument();
    });

    it('clears every filter at once', async () => {
      const user = userEvent.setup();

      render(<UserAdminTable />);
      await waitFor(() => expect(api.listUsers).toHaveBeenCalled());

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'active');
      await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

      await waitFor(() =>
        expect(api.listUsers.mock.calls.at(-1)?.[0]).not.toHaveProperty('isActive'),
      );
    });

    it('keeps the search box focused while results reload', async () => {
      const user = userEvent.setup();

      render(<UserAdminTable />);
      await waitFor(() => expect(api.listUsers).toHaveBeenCalled());

      const box = screen.getByLabelText('Search users');
      await user.type(box, 'gr');

      expect(box).toHaveFocus();
      expect(box).toHaveValue('gr');
    });
  });
});
