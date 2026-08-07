import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConfirmDialog } from './confirm-dialog';

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();

  const view = render(
    <ConfirmDialog
      open
      title="Delete this movie?"
      description="This cannot be undone."
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );

  return { onConfirm, onCancel, view };
}

describe('ConfirmDialog', () => {
  it('announces itself as an alert dialog with a name and a description', () => {
    setup();

    const dialog = screen.getByRole('alertdialog', { name: 'Delete this movie?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
  });

  it('stays out of the tree until it is opened', () => {
    setup({ open: false });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('gives focus to cancel, so Enter takes the safe path', () => {
    setup({ cancelLabel: 'Keep it' });

    expect(screen.getByRole('button', { name: 'Keep it' })).toHaveFocus();
  });

  it('confirms and cancels through their buttons', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup({ confirmLabel: 'Delete movie' });

    await user.click(screen.getByRole('button', { name: 'Delete movie' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape', async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalled();
  });

  it('renders the preview slot so the user sees what they are acting on', () => {
    setup({ preview: <p>Heat (1995)</p> });

    expect(screen.getByText('Heat (1995)')).toBeInTheDocument();
  });

  describe('while the action is in flight', () => {
    it('swaps the confirm label and locks both buttons', () => {
      setup({ isBusy: true, confirmLabel: 'Delete movie', busyLabel: 'Deleting…' });

      expect(screen.queryByRole('button', { name: 'Delete movie' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('ignores Escape, so the request is never abandoned half-way', async () => {
      const user = userEvent.setup();
      const { onCancel } = setup({ isBusy: true });

      await user.keyboard('{Escape}');

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  it('shows a failure inside the dialog, where it is readable', () => {
    setup({ error: 'Could not delete the movie.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete the movie.');
    // Still open, so the confirm button doubles as retry.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('does not call back when the parent closes it', () => {
    const onCancel = jest.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        title="Delete this movie?"
        description="This cannot be undone."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );

    rerender(
      <ConfirmDialog
        open={false}
        title="Delete this movie?"
        description="This cannot be undone."
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );

    expect(onCancel).not.toHaveBeenCalled();
  });
});
