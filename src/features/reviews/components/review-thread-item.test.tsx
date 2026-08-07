import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Review } from '@/types/api';
import { ReviewThreadItem } from './review-thread-item';

const build = (overrides: Partial<Review> = {}): Review => ({
  id: 'r-1',
  movieId: 'm-1',
  userId: 'u-1',
  rating: 4,
  comment: 'Great film.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  author: { id: 'u-1', fullName: 'Grace Hopper' },
  ...overrides,
});

const renderItem = (props: Partial<React.ComponentProps<typeof ReviewThreadItem>> = {}) =>
  render(
    <ul>
      <ReviewThreadItem review={build()} isMine={false} {...props} />
    </ul>,
  );

describe('ReviewThreadItem', () => {
  it('leads with who said it', () => {
    renderItem();

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('Great film.')).toBeInTheDocument();
  });

  it('says "You" instead of your own name', () => {
    renderItem({ isMine: true });

    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
  });

  it('falls back when the author is missing', () => {
    const { author: _dropped, ...withoutAuthor } = build();
    renderItem({ review: withoutAuthor });

    expect(screen.getByText('A viewer')).toBeInTheDocument();
  });

  it('marks a review that was changed after posting', () => {
    renderItem({
      review: build({
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-05T00:00:00.000Z',
      }),
    });

    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it('does not call a save a second apart an edit', () => {
    // Sequelize touches updatedAt on insert; that is not the user editing.
    renderItem({
      review: build({
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:01.000Z',
      }),
    });

    expect(screen.queryByText(/edited/)).not.toBeInTheDocument();
  });

  it('carries a machine-readable timestamp alongside the relative one', () => {
    renderItem();

    expect(screen.getByText(/ago|just now/)).toHaveAttribute('datetime', '2026-01-01T00:00:00.000Z');
  });

  it('says a rating with no comment is deliberate, not missing', () => {
    renderItem({ review: build({ comment: null }) });

    expect(screen.getByText(/left no comment/)).toBeInTheDocument();
  });

  it('offers the owner controls only to the owner', () => {
    const onEdit = jest.fn();
    renderItem({ isMine: false, onEdit });

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('wires the owner controls', async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    renderItem({ isMine: true, onEdit, onDelete });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('locks the owner controls while a save is in flight', () => {
    renderItem({ isMine: true, onEdit: jest.fn(), onDelete: jest.fn(), isBusy: true });

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
