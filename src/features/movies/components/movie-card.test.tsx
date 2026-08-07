import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWatchlistStore } from '@/store/watchlist.store';
import { movieFactory } from '@/testing/factories/movie.factory';
import { seedFaker } from '@/testing/factory';
import { MovieCard } from './movie-card';

describe('MovieCard', () => {
  beforeEach(() => {
    seedFaker();
    useWatchlistStore.setState({ byMovieId: {}, isLoaded: true, pending: {}, error: null });
  });

  it('is a single button covering the whole tile', () => {
    const movie = movieFactory.build({ title: 'Blade Runner 2049', releaseYear: 2017 });

    render(<MovieCard movie={movie} onSelect={jest.fn()} />);

    // One control, not a div-with-onClick: keyboard users get it for free.
    expect(
      screen.getByRole('button', { name: /Blade Runner 2049, 2017\. View details/ }),
    ).toBeInTheDocument();
  });

  it('reports the selected movie on click', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const movie = movieFactory.build();

    render(<MovieCard movie={movie} onSelect={onSelect} />);
    await user.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith(movie);
  });

  it('activates from the keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();

    render(<MovieCard movie={movieFactory.build()} onSelect={onSelect} />);
    await user.tab();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows the rating, year, runtime and genre in the overlay', () => {
    const movie = movieFactory.build({
      rating: 8,
      genre: 'SCI_FI',
      releaseYear: 2017,
      durationMinutes: 164,
    });

    render(<MovieCard movie={movie} onSelect={jest.fn()} />);

    expect(screen.getByText('8.0')).toBeInTheDocument();
    expect(screen.getByText('2017')).toBeInTheDocument();
    expect(screen.getByText('2h 44m')).toBeInTheDocument();
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
  });

  it('badges a movie that is on the watchlist', () => {
    const movie = movieFactory.build();
    useWatchlistStore.setState({ byMovieId: { [movie.id]: 'WATCHED' } });

    render(<MovieCard movie={movie} onSelect={jest.fn()} />);

    expect(screen.getByText('✓ Watched')).toBeInTheDocument();
  });

  it('labels a WANT entry with its status', () => {
    const movie = movieFactory.build();
    useWatchlistStore.setState({ byMovieId: { [movie.id]: 'WANT' } });

    render(<MovieCard movie={movie} onSelect={jest.fn()} />);

    expect(screen.getByText('Want to watch')).toBeInTheDocument();
  });

  it('shows no badge for a movie that is not on the list', () => {
    render(<MovieCard movie={movieFactory.build()} onSelect={jest.fn()} />);

    expect(screen.queryByText(/Watched|Watching|Want to watch/)).not.toBeInTheDocument();
  });

  it('merges a caller-provided className', () => {
    const { container } = render(
      <MovieCard movie={movieFactory.build()} onSelect={jest.fn()} className="custom-class" />,
    );

    expect(container.firstElementChild).toHaveClass('custom-class');
  });
});
