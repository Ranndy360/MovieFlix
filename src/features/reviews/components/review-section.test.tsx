import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as reviewsApi from '@/features/reviews/api/reviews.api';
import { useAuthStore } from '@/store/auth.store';
import { useWatchlistStore } from '@/store/watchlist.store';
import { buildUser } from '@/testing/factories/auth.factory';
import type { Paginated, Review } from '@/types/api';
import { ReviewSection } from './review-section';

jest.mock('@/features/reviews/api/reviews.api');

const api = reviewsApi as jest.Mocked<typeof reviewsApi>;
const MOVIE = 'movie-1';

const page = (items: Review[]): Paginated<Review> => ({
  items,
  meta: {
    page: 1,
    pageSize: 20,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
});

const buildReview = (overrides: Partial<Review> = {}): Review => ({
  id: 'review-1',
  movieId: MOVIE,
  userId: 'user-1',
  rating: 4,
  comment: 'Great film.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  author: { id: 'user-1', fullName: 'Grace Hopper' },
  ...overrides,
});

const signIn = (id = 'user-1'): void => {
  useAuthStore.setState({
    user: buildUser('USER', { id }),
    status: 'authenticated',
    error: null,
  });
};

const markWatched = (): void => {
  useWatchlistStore.setState({ byMovieId: { [MOVIE]: 'WATCHED' }, isLoaded: true });
};

describe('ReviewSection', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'unauthenticated', error: null });
    useWatchlistStore.setState({ byMovieId: {}, isLoaded: true, pending: {}, error: null });
    api.listReviews.mockResolvedValue(page([]));
  });

  it('tells an anonymous visitor what is required', async () => {
    render(<ReviewSection movieId={MOVIE} />);

    expect(
      await screen.findByText(/Sign in and mark this movie as watched/),
    ).toBeInTheDocument();
  });

  it('mirrors the API rule: no editor until the movie is watched', async () => {
    signIn();
    render(<ReviewSection movieId={MOVIE} />);

    expect(await screen.findByText(/Mark this movie as watched to join/)).toBeInTheDocument();
    // Never offer a control whose only outcome would be a 422.
    expect(screen.queryByRole('button', { name: 'Post review' })).not.toBeInTheDocument();
  });

  it('shows the editor once the movie is watched', async () => {
    signIn();
    markWatched();
    render(<ReviewSection movieId={MOVIE} />);

    expect(await screen.findByRole('button', { name: 'Post review' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Your rating/ })).toBeInTheDocument();
  });

  it('refuses to submit without a rating', async () => {
    signIn();
    markWatched();
    const user = userEvent.setup();
    render(<ReviewSection movieId={MOVIE} />);

    await user.click(await screen.findByRole('button', { name: 'Post review' }));

    // A nudge, not a failure: `status` waits for a pause instead of interrupting.
    expect(await screen.findByRole('status')).toHaveTextContent(/Pick a star rating first/);
    expect(api.createReview).not.toHaveBeenCalled();
  });

  it('creates a review with rating and comment', async () => {
    signIn();
    markWatched();
    const user = userEvent.setup();
    api.createReview.mockResolvedValue(buildReview());
    render(<ReviewSection movieId={MOVIE} />);

    await user.click(await screen.findByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/Comment/), 'Loved it');
    await user.click(screen.getByRole('button', { name: 'Post review' }));

    await waitFor(() =>
      expect(api.createReview).toHaveBeenCalledWith({
        movieId: MOVIE,
        rating: 5,
        comment: 'Loved it',
      }),
    );
  });

  it('omits an empty comment rather than sending a blank string', async () => {
    signIn();
    markWatched();
    const user = userEvent.setup();
    api.createReview.mockResolvedValue(buildReview());
    render(<ReviewSection movieId={MOVIE} />);

    await user.click(await screen.findByRole('radio', { name: '3 stars' }));
    await user.click(screen.getByRole('button', { name: 'Post review' }));

    await waitFor(() => expect(api.createReview).toHaveBeenCalledWith({ movieId: MOVIE, rating: 3 }));
  });

  it('stands down the composer once you have had your say', async () => {
    signIn();
    markWatched();
    api.listReviews.mockResolvedValue(page([buildReview({ userId: 'user-1', rating: 4 })]));

    render(<ReviewSection movieId={MOVIE} />);

    // Your review is in the thread now; a second composer above it would be a
    // duplicate of something already on screen.
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Post review' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Comment/)).not.toBeInTheDocument();
  });

  it('reopens the composer, seeded, when you choose to edit', async () => {
    signIn();
    markWatched();
    api.listReviews.mockResolvedValue(
      page([buildReview({ userId: 'user-1', rating: 4, comment: 'My take' })]),
    );
    const user = userEvent.setup();

    render(<ReviewSection movieId={MOVIE} />);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('radio', { name: '4 stars' })).toBeChecked();
    expect(screen.getByLabelText(/Comment/)).toHaveValue('My take');
    expect(screen.getByRole('button', { name: 'Update review' })).toBeInTheDocument();
  });

  it('backs out of editing without touching the review', async () => {
    signIn();
    markWatched();
    api.listReviews.mockResolvedValue(page([buildReview({ userId: 'user-1' })]));
    const user = userEvent.setup();

    render(<ReviewSection movieId={MOVIE} />);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText(/Comment/)).not.toBeInTheDocument();
    expect(api.updateReview).not.toHaveBeenCalled();
  });

  it('updates instead of creating when a review exists', async () => {
    signIn();
    markWatched();
    api.listReviews.mockResolvedValue(page([buildReview({ id: 'r-9', userId: 'user-1' })]));
    api.updateReview.mockResolvedValue(buildReview({ id: 'r-9', rating: 2 }));
    const user = userEvent.setup();

    render(<ReviewSection movieId={MOVIE} />);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('radio', { name: '2 stars' }));
    await user.click(screen.getByRole('button', { name: 'Update review' }));

    await waitFor(() => expect(api.updateReview).toHaveBeenCalledWith('r-9', expect.objectContaining({ rating: 2 })));
    expect(api.createReview).not.toHaveBeenCalled();
  });

  it('asks before deleting my review', async () => {
    signIn();
    markWatched();
    api.listReviews.mockResolvedValue(page([buildReview({ id: 'r-9', userId: 'user-1' })]));
    api.deleteReview.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<ReviewSection movieId={MOVIE} />);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    // One click used to be enough to lose what you wrote.
    expect(screen.getByRole('alertdialog', { name: 'Delete your review?' })).toBeInTheDocument();
    expect(api.deleteReview).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete review' }));
    await waitFor(() => expect(api.deleteReview).toHaveBeenCalledWith('r-9'));
  });

  it('leaves the review alone when the confirmation is declined', async () => {
    signIn();
    markWatched();
    api.listReviews.mockResolvedValue(page([buildReview({ id: 'r-9', userId: 'user-1' })]));
    const user = userEvent.setup();

    render(<ReviewSection movieId={MOVIE} />);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(api.deleteReview).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  describe('the thread', () => {
    it('puts everyone in the same list, with mine marked as mine', async () => {
      signIn('user-1');
      markWatched();
      api.listReviews.mockResolvedValue(
        page([
          buildReview({ id: 'mine', userId: 'user-1', comment: 'My take' }),
          buildReview({
            id: 'theirs',
            userId: 'user-2',
            comment: 'Their take',
            author: { id: 'user-2', fullName: 'Ada Lovelace' },
          }),
        ]),
      );

      render(<ReviewSection movieId={MOVIE} />);

      const list = await screen.findByRole('list');
      expect(within(list).getByText('My take')).toBeInTheDocument();
      expect(within(list).getByText('Their take')).toBeInTheDocument();
      expect(within(list).getByText('You')).toBeInTheDocument();
      expect(within(list).getByText('Ada Lovelace')).toBeInTheDocument();
    });

    it('reads oldest first, so it accumulates downward', async () => {
      render(<ReviewSection movieId={MOVIE} />);

      await waitFor(() =>
        expect(api.listReviews).toHaveBeenCalledWith(
          expect.objectContaining({ sortBy: 'createdAt', sortDirection: 'ASC' }),
          expect.anything(),
        ),
      );
    });

    it('keeps the order the server gave it', async () => {
      api.listReviews.mockResolvedValue(
        page([
          buildReview({ id: 'a', userId: 'u-a', comment: 'First word' }),
          buildReview({ id: 'b', userId: 'u-b', comment: 'Last word' }),
        ]),
      );

      render(<ReviewSection movieId={MOVIE} />);

      const items = within(await screen.findByRole('list')).getAllByRole('listitem');
      expect(items[0]).toHaveTextContent('First word');
      expect(items[1]).toHaveTextContent('Last word');
    });

    it('names an author the API could not resolve', async () => {
      const { author: _dropped, ...withoutAuthor } = buildReview({ comment: 'Orphaned' });
      api.listReviews.mockResolvedValue(page([withoutAuthor]));

      render(<ReviewSection movieId={MOVIE} />);

      expect(await screen.findByText('A viewer')).toBeInTheDocument();
    });

    it('says so when someone rated without writing anything', async () => {
      api.listReviews.mockResolvedValue(page([buildReview({ comment: null })]));

      render(<ReviewSection movieId={MOVIE} />);

      expect(await screen.findByText(/left no comment/)).toBeInTheDocument();
    });

    it('appends the next page instead of replacing the thread', async () => {
      const user = userEvent.setup();
      api.listReviews.mockResolvedValueOnce({
        items: [buildReview({ id: 'a', comment: 'Oldest' })],
        meta: { page: 1, pageSize: 10, totalItems: 2, totalPages: 2, hasNextPage: true, hasPreviousPage: false },
      });

      render(<ReviewSection movieId={MOVIE} />);
      expect(await screen.findByText('Oldest')).toBeInTheDocument();

      api.listReviews.mockResolvedValueOnce({
        items: [buildReview({ id: 'b', comment: 'Newer' })],
        meta: { page: 2, pageSize: 10, totalItems: 2, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
      });
      await user.click(screen.getByRole('button', { name: /Show earlier reviews/ }));

      // Both, not just the second page.
      expect(await screen.findByText('Newer')).toBeInTheDocument();
      expect(screen.getByText('Oldest')).toBeInTheDocument();
    });

    it('does not double up a review that shifted pages mid-read', async () => {
      const user = userEvent.setup();
      const shared = buildReview({ id: 'a', comment: 'Straddles the boundary' });
      api.listReviews.mockResolvedValueOnce({
        items: [shared],
        meta: { page: 1, pageSize: 10, totalItems: 2, totalPages: 2, hasNextPage: true, hasPreviousPage: false },
      });

      render(<ReviewSection movieId={MOVIE} />);
      await screen.findByText('Straddles the boundary');

      api.listReviews.mockResolvedValueOnce({
        items: [shared, buildReview({ id: 'b', comment: 'Genuinely new' })],
        meta: { page: 2, pageSize: 10, totalItems: 2, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
      });
      await user.click(screen.getByRole('button', { name: /Show earlier reviews/ }));

      expect(await screen.findByText('Genuinely new')).toBeInTheDocument();
      expect(screen.getAllByText('Straddles the boundary')).toHaveLength(1);
    });

    it('counts the whole thread in the heading, not just what is loaded', async () => {
      api.listReviews.mockResolvedValue({
        items: [buildReview()],
        meta: { page: 1, pageSize: 10, totalItems: 42, totalPages: 5, hasNextPage: true, hasPreviousPage: false },
      });

      render(<ReviewSection movieId={MOVIE} />);

      expect(await screen.findByRole('heading', { name: 'Reviews (42)' })).toBeInTheDocument();
    });
  });

  it('shows an empty state when nobody has reviewed', async () => {
    render(<ReviewSection movieId={MOVIE} />);

    expect(await screen.findByText(/No reviews yet/)).toBeInTheDocument();
  });

  it('surfaces a server error from the API', async () => {
    signIn();
    markWatched();
    api.createReview.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();

    render(<ReviewSection movieId={MOVIE} />);
    await user.click(await screen.findByRole('radio', { name: '5 stars' }));
    await user.click(screen.getByRole('button', { name: 'Post review' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
