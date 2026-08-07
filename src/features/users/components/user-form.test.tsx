import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as usersApi from '@/features/users/api/users.api';
import { buildUser } from '@/testing/factories/auth.factory';
import { UserForm } from './user-form';

jest.mock('@/features/users/api/users.api');

const api = usersApi as jest.Mocked<typeof usersApi>;

const fill = async (
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<Record<string, string>> = {},
): Promise<void> => {
  const values = {
    'First name': 'Grace',
    'Last name': 'Hopper',
    Email: 'grace@test.io',
    'Temporary password': 'Str0ng!Passw0rd',
    ...overrides,
  };

  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (value) await user.type(input, value);
  }
};

describe('UserForm', () => {
  beforeEach(() => {
    api.createUser.mockResolvedValue(buildUser('USER'));
  });

  it('offers every role, including ADMIN', () => {
    render(<UserForm onCreated={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByRole('option', { name: 'Administrator' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Provider' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'User' })).toBeInTheDocument();
  });

  it('defaults to the least privileged role', () => {
    render(<UserForm onCreated={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByLabelText('Role')).toHaveValue('USER');
  });

  it('submits the chosen role', async () => {
    const user = userEvent.setup();
    render(<UserForm onCreated={jest.fn()} onCancel={jest.fn()} />);

    await fill(user);
    await user.selectOptions(screen.getByLabelText('Role'), 'PROVIDER');
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() =>
      expect(api.createUser).toHaveBeenCalledWith({
        email: 'grace@test.io',
        password: 'Str0ng!Passw0rd',
        firstName: 'Grace',
        lastName: 'Hopper',
        role: 'PROVIDER',
      }),
    );
  });

  it('masks the password field', () => {
    render(<UserForm onCreated={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByLabelText('Temporary password')).toHaveAttribute('type', 'password');
  });

  it('enforces the password policy before hitting the API', async () => {
    const user = userEvent.setup();
    render(<UserForm onCreated={jest.fn()} onCancel={jest.fn()} />);

    await fill(user, { 'Temporary password': 'weak' });
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    expect(await screen.findByText(/At least 12 characters/)).toBeInTheDocument();
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const user = userEvent.setup();
    render(<UserForm onCreated={jest.fn()} onCancel={jest.fn()} />);

    await fill(user, { Email: 'nope' });
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('requires both names', async () => {
    const user = userEvent.setup();
    render(<UserForm onCreated={jest.fn()} onCancel={jest.fn()} />);

    await fill(user, { 'First name': '', 'Last name': '' });
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
  });

  it('reports the created user', async () => {
    const user = userEvent.setup();
    const created = buildUser('PROVIDER');
    api.createUser.mockResolvedValue(created);
    const onCreated = jest.fn();

    render(<UserForm onCreated={onCreated} onCancel={jest.fn()} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
  });

  it('surfaces a duplicate-email error from the server', async () => {
    const user = userEvent.setup();
    api.createUser.mockRejectedValue(new Error('conflict'));

    render(<UserForm onCreated={jest.fn()} onCancel={jest.fn()} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create user' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('can be cancelled', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();

    render(<UserForm onCreated={jest.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });
});
