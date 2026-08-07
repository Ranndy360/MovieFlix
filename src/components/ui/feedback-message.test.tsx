import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FeedbackMessage } from './feedback-message';

describe('FeedbackMessage', () => {
  it('interrupts for an error', () => {
    render(<FeedbackMessage tone="error" title="We could not save this title">Try again.</FeedbackMessage>);

    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent('We could not save this title');
    expect(message).toHaveTextContent('Try again.');
  });

  it.each(['success', 'info'] as const)('waits for a pause on a %s message', (tone) => {
    render(<FeedbackMessage tone={tone} title="Saved" />);

    // `status` is polite; announcing every success as urgently as a failure is
    // how a screen reader turns into noise.
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('works with a body and no title', () => {
    render(<FeedbackMessage tone="info">Just the one line.</FeedbackMessage>);

    expect(screen.getByRole('status')).toHaveTextContent('Just the one line.');
  });

  it('is dismissible only when the caller offers it', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();

    const { rerender } = render(<FeedbackMessage tone="success" title="Saved" />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();

    rerender(<FeedbackMessage tone="success" title="Saved" onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps the icon out of the announcement', () => {
    render(<FeedbackMessage tone="error" title="Broken" />);

    expect(screen.getByRole('alert')).toHaveTextContent(/^Broken$/);
  });
});
