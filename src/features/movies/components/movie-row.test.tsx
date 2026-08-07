import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useWatchlistStore } from '@/store/watchlist.store';
import { movieFactory } from '@/testing/factories/movie.factory';
import { MovieRow } from './movie-row';

// jsdom implements neither of these on elements.
beforeAll(() => {
  Element.prototype.scrollBy = jest.fn();
});

describe('MovieRow', () => {
  beforeEach(() => {
    useWatchlistStore.setState({ byMovieId: {}, isLoaded: true, pending: {}, error: null });
  });

  it('labels the row with its title', () => {
    render(<MovieRow title="Top Rated" movies={movieFactory.buildMany(3)} onSelect={jest.fn()} />);

    expect(screen.getByRole('region', { name: 'Top Rated' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Top Rated' })).toBeInTheDocument();
  });

  it('renders one tile per movie', () => {
    render(<MovieRow title="Sci-Fi" movies={movieFactory.buildMany(5)} onSelect={jest.fn()} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('reports the clicked movie', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const movies = movieFactory.buildMany(2);

    render(<MovieRow title="Drama" movies={movies} onSelect={onSelect} />);
    await user.click(screen.getAllByRole('button')[0]!);

    expect(onSelect).toHaveBeenCalledWith(movies[0]);
  });

  it('renders skeletons while loading', () => {
    render(<MovieRow title="Loading" movies={[]} onSelect={jest.fn()} isLoading />);

    expect(screen.getByRole('heading', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('renders nothing at all for an empty, settled row', () => {
    const { container } = render(<MovieRow title="Empty" movies={[]} onSelect={jest.fn()} />);

    // A lone heading over no content is worse than no row.
    expect(container).toBeEmptyDOMElement();
  });

  it('hides both arrows when there is nothing to scroll', () => {
    // jsdom reports zero dimensions, so scrollWidth === clientWidth.
    render(<MovieRow title="Short" movies={movieFactory.buildMany(2)} onSelect={jest.fn()} />);

    expect(screen.queryByRole('button', { name: /Scroll Short/ })).not.toBeInTheDocument();
  });
});
