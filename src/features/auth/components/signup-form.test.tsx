import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as authApi from '@/features/auth/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { buildSession, buildUser } from '@/testing/factories/auth.factory';
import { SignupForm } from './signup-form';

jest.mock('@/features/auth/api/auth.api');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));

/** jsdom refuses to navigate for real, so `location` is swapped for a double. */
const realLocation = window.location;

function stubLocation(): { assign: jest.Mock } {
  const stub = { pathname: '/signup', assign: jest.fn(), replace: jest.fn() };
  Object.defineProperty(window, 'location', { value: stub, writable: true, configurable: true });
  return stub;
}

const api = authApi as jest.Mocked<typeof authApi>;

const fill = async (
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<Record<string, string>> = {},
): Promise<void> => {
  const values = {
    'First name': 'Ada',
    'Last name': 'Lovelace',
    Email: 'ada@test.io',
    Password: 'Str0ng!Passw0rd',
    'Confirm password': 'Str0ng!Passw0rd',
    ...overrides,
  };

  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (value) await user.type(input, value);
  }
};

describe('SignupForm', () => {
  let location: { assign: jest.Mock };

  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'idle', error: null });
    location = stubLocation();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: realLocation,
      writable: true,
      configurable: true,
    });
  });

  it('offers no way to choose a role', () => {
    render(<SignupForm />);

    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('states that new accounts get the User role', () => {
    render(<SignupForm />);

    expect(screen.getByText(/created with the/i)).toHaveTextContent('User');
  });

  it('never sends a role field to the API', async () => {
    const user = userEvent.setup();
    api.register.mockResolvedValue(buildSession(buildUser('USER')));
    render(<SignupForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(api.register).toHaveBeenCalled());
    const payload = api.register.mock.calls[0]?.[0] ?? {};
    expect(payload).not.toHaveProperty('role');
    expect(Object.keys(payload).sort()).toEqual([
      'email',
      'firstName',
      'lastName',
      'password',
    ]);
  });

  it('rejects a password that fails the policy', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await fill(user, { Password: 'weakpass', 'Confirm password': 'weakpass' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/At least 12 characters/)).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('rejects a long-but-simple password', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await fill(user, {
      Password: 'alllowercaseletters',
      'Confirm password': 'alllowercaseletters',
    });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/At least 12 characters/)).toBeInTheDocument();
  });

  it('requires the confirmation to match', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await fill(user, { 'Confirm password': 'Different!Passw0rd' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });

  it('requires both names', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await fill(user, { 'First name': '', 'Last name': '' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
  });

  it('uses new-password autocomplete so managers offer a generated one', () => {
    render(<SignupForm />);

    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('lands on the home page once the account exists', async () => {
    const user = userEvent.setup();
    api.register.mockResolvedValue(buildSession(buildUser('USER')));
    render(<SignupForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(location.assign).toHaveBeenCalledWith('/'));
  });

  it('crosses the session boundary with a real navigation', async () => {
    const user = userEvent.setup();
    api.register.mockResolvedValue(buildSession(buildUser('USER')));
    render(<SignupForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    // `router.replace` + `router.refresh` cancelled each other and left the
    // user on the submitted form. A document navigation cannot be cancelled.
    await waitFor(() => expect(location.assign).toHaveBeenCalled());
  });

  it('shows a duplicate-email error from the server', async () => {
    const user = userEvent.setup();
    api.register.mockRejectedValue(new Error('conflict'));
    render(<SignupForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // A failed signup must leave you on the form, with what you typed intact.
    expect(location.assign).not.toHaveBeenCalled();
  });

  describe('revealing the password', () => {
    it('starts masked', () => {
      render(<SignupForm />);

      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
      expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
    });

    it('shows the characters on demand and hides them again', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await user.click(screen.getByRole('button', { name: 'Show password' }));
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');

      // The name flips too, so a screen reader is told what the button does now.
      await user.click(screen.getByRole('button', { name: 'Hide password' }));
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    });

    it('keeps the two fields independent', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await user.click(screen.getByRole('button', { name: 'Show password' }));

      // Revealing one must not expose the other.
      expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
      expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
    });

    it('keeps what was typed when the mask is lifted', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await user.type(screen.getByLabelText('Password'), 'Str0ng!Passw0rd');
      await user.click(screen.getByRole('button', { name: 'Show password' }));

      expect(screen.getByLabelText('Password')).toHaveValue('Str0ng!Passw0rd');
    });

    it('does not submit the form', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      await user.click(screen.getByRole('button', { name: 'Show password' }));

      // A bare <button> inside a form defaults to type="submit".
      expect(api.register).not.toHaveBeenCalled();
    });

    it('leaves the fields that are not passwords alone', () => {
      render(<SignupForm />);

      expect(screen.queryByRole('button', { name: /Show email/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Show first name/i })).not.toBeInTheDocument();
    });
  });
});
