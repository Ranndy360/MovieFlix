import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useMovieFiltersStore } from '@/store/movie-filters.store';
import { MovieFiltersBar } from './movie-filters-bar';

describe('MovieFiltersBar', () => {
  beforeEach(() => {
    useMovieFiltersStore.getState().reset();
  });

  it('renders labelled search and genre controls', () => {
    render(<MovieFiltersBar />);

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByLabelText('Genre')).toBeInTheDocument();
  });

  it('writes the typed term into the store', async () => {
    const user = userEvent.setup();
    render(<MovieFiltersBar />);

    await user.type(screen.getByLabelText('Search'), 'dune');

    expect(useMovieFiltersStore.getState().search).toBe('dune');
  });

  it('lists every genre plus an "all" option', () => {
    render(<MovieFiltersBar />);

    expect(screen.getByRole('option', { name: 'All genres' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sci-Fi' })).toBeInTheDocument();
  });

  it('stores the selected genre', async () => {
    const user = userEvent.setup();
    render(<MovieFiltersBar />);

    await user.selectOptions(screen.getByLabelText('Genre'), 'HORROR');

    expect(useMovieFiltersStore.getState().genre).toBe('HORROR');
  });

  it('maps the empty option back to null', async () => {
    const user = userEvent.setup();
    useMovieFiltersStore.getState().setGenre('HORROR');
    render(<MovieFiltersBar />);

    await user.selectOptions(screen.getByLabelText('Genre'), '');

    expect(useMovieFiltersStore.getState().genre).toBeNull();
  });

  it('clears every filter on reset', async () => {
    const user = userEvent.setup();
    useMovieFiltersStore.getState().setSearch('dune');
    useMovieFiltersStore.getState().setGenre('COMEDY');
    render(<MovieFiltersBar />);

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(useMovieFiltersStore.getState()).toMatchObject({ search: '', genre: null });
  });

  it('reflects state that changed outside the component', () => {
    useMovieFiltersStore.getState().setSearch('arrival');

    render(<MovieFiltersBar />);

    expect(screen.getByLabelText('Search')).toHaveValue('arrival');
  });
});
