import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAuthStore } from '@/store/auth.store';
import { useWatchlistStore } from '@/store/watchlist.store';
import { movieFactory } from '@/testing/factories/movie.factory';
import { HeroBillboard } from './hero-billboard';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('HeroBillboard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, status: 'unauthenticated', error: null });
    useWatchlistStore.setState({ byMovieId: {}, isLoaded: true, pending: {}, error: null });
  });

  it('shows a skeleton while loading', () => {
    render(<HeroBillboard movie={null} onMoreInfo={jest.fn()} isLoading />);

    expect(screen.getByLabelText('Loading featured movie')).toBeInTheDocument();
  });

  it('renders the title as the page h1', () => {
    const movie = movieFactory.build({ title: 'Interstellar' });

    render(<HeroBillboard movie={movie} onMoreInfo={jest.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Interstellar' })).toBeInTheDocument();
  });

  it('shows the rating, year and runtime', () => {
    const movie = movieFactory.build({ rating: 8.7, releaseYear: 2014, durationMinutes: 169 });

    render(<HeroBillboard movie={movie} onMoreInfo={jest.fn()} />);

    expect(screen.getByText('8.7')).toBeInTheDocument();
    expect(screen.getByText('2014')).toBeInTheDocument();
    expect(screen.getByText('169 min')).toBeInTheDocument();
  });

  it('opens details from both Play and More Info', async () => {
    const user = userEvent.setup();
    const onMoreInfo = jest.fn();
    const movie = movieFactory.build();

    render(<HeroBillboard movie={movie} onMoreInfo={onMoreInfo} />);

    await user.click(screen.getByRole('button', { name: /Play/ }));
    await user.click(screen.getByRole('button', { name: /More Info/ }));

    expect(onMoreInfo).toHaveBeenCalledTimes(2);
    expect(onMoreInfo).toHaveBeenCalledWith(movie);
  });

  it('includes a watchlist control', () => {
    render(<HeroBillboard movie={movieFactory.build()} onMoreInfo={jest.fn()} />);

    expect(screen.getByRole('button', { name: /My List/ })).toBeInTheDocument();
  });
});
