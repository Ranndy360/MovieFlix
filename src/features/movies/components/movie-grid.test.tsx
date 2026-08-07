import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWatchlistStore } from '@/store/watchlist.store';
import { buildMoviePage, movieFactory } from '@/testing/factories/movie.factory';
import { MovieGrid } from './movie-grid';

const noop = jest.fn();

const defaults = {
  meta: null,
  isLoading: false,
  error: null,
  onSelect: noop,
  onRetry: noop,
  onPageChange: noop,
};

describe('MovieGrid', () => {
  beforeEach(() => {
    useWatchlistStore.setState({ byMovieId: {}, isLoaded: true, pending: {}, error: null });
  });

  it('shows a busy skeleton while loading', () => {
    render(<MovieGrid {...defaults} movies={[]} isLoading />);

    expect(screen.getByLabelText('Loading movies')).toBeInTheDocument();
  });

  it('shows an alert and a retry on error', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();

    render(<MovieGrid {...defaults} movies={[]} error="Service unavailable" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows an empty state when nothing matches', () => {
    render(<MovieGrid {...defaults} movies={[]} />);

    expect(screen.getByText('Nothing matches those filters')).toBeInTheDocument();
  });

  it('renders one tile per movie', () => {
    render(<MovieGrid {...defaults} movies={movieFactory.buildMany(4)} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('hides pagination for a single page', () => {
    const page = buildMoviePage(3);

    render(<MovieGrid {...defaults} movies={page.items} meta={page.meta} />);

    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('paginates across multiple pages', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    const page = buildMoviePage(3, {
      page: 2,
      totalPages: 5,
      totalItems: 60,
      hasNextPage: true,
      hasPreviousPage: true,
    });

    render(
      <MovieGrid {...defaults} movies={page.items} meta={page.meta} onPageChange={onPageChange} />,
    );

    expect(screen.getByText(/Page 2 of 5 · 60 titles/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables Previous on the first page', () => {
    const page = buildMoviePage(3, { page: 1, totalPages: 3, hasPreviousPage: false });

    render(<MovieGrid {...defaults} movies={page.items} meta={page.meta} />);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});
