import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAuthStore } from '@/store/auth.store';
import * as authApi from '@/features/auth/api/auth.api';
import { buildSession } from '@/testing/factories/auth.factory';
import { LoginForm } from './login-form';

jest.mock('@/features/auth/api/auth.api');

const replace = jest.fn();
const refresh = jest.fn();
let searchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => searchParams,
}));

const api = authApi as jest.Mocked<typeof authApi>;

describe('LoginForm', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    useAuthStore.setState({ user: null, status: 'idle', error: null });
  });

  it('renders labelled email and password fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('uses a password input so the value is masked', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('sets autocomplete hints for password managers', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('validates locally before hitting the network', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('submits valid credentials', async () => {
    const user = userEvent.setup();
    api.login.mockResolvedValue(buildSession());
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'ada@test.io');
    await user.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(api.login).toHaveBeenCalledWith({
        email: 'ada@test.io',
        password: 'Str0ng!Passw0rd',
      }),
    );
  });

  it('redirects to the catalog on success', async () => {
    const user = userEvent.setup();
    api.login.mockResolvedValue(buildSession());
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'ada@test.io');
    await user.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/movies'));
  });

  it('honours a same-origin ?next redirect', async () => {
    searchParams = new URLSearchParams('next=/admin/users');
    const user = userEvent.setup();
    api.login.mockResolvedValue(buildSession());
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'ada@test.io');
    await user.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/users'));
  });

  it('refuses an absolute ?next URL — no open redirect', async () => {
    searchParams = new URLSearchParams('next=https://evil.test/phish');
    const user = userEvent.setup();
    api.login.mockResolvedValue(buildSession());
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'ada@test.io');
    await user.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/movies'));
  });

  it('refuses a protocol-relative ?next URL', async () => {
    searchParams = new URLSearchParams('next=//evil.test/phish');
    const user = userEvent.setup();
    api.login.mockResolvedValue(buildSession());
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'ada@test.io');
    await user.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/movies'));
  });

  it('shows the server error and stays put', async () => {
    const user = userEvent.setup();
    api.login.mockRejectedValue(new Error('nope'));
    render(<LoginForm />);

    await user.type(screen.getByLabelText('Email'), 'ada@test.io');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
