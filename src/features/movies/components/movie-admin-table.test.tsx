import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as moviesApi from '@/features/movies/api/movies.api';
import { useAuthStore } from '@/store/auth.store';
import { buildAdmin, buildUser } from '@/testing/factories/auth.factory';
import { movieFactory } from '@/testing/factories/movie.factory';
import type { Movie, Paginated } from '@/types/api';
import { MovieAdminTable } from './movie-admin-table';

jest.mock('@/features/movies/api/movies.api');

const api = moviesApi as jest.Mocked<typeof moviesApi>;

const page = (items: Movie[]): Paginated<Movie> => ({
  items,
  meta: {
    page: 1,
    pageSize: 100,
    totalItems: items.length,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
});

const signInAdmin = (): string => {
  const admin = buildAdmin();
  useAuthStore.setState({ user: admin, status: 'authenticated', error: null });
  return admin.id;
};

const signInProvider = (): string => {
  const provider = buildUser('PROVIDER');
  useAuthStore.setState({ user: provider, status: 'authenticated', error: null });
  return provider.id;
};

describe('MovieAdminTable', () => {
  beforeEach(() => {
    api.listMovies.mockResolvedValue(page([]));
  });

  describe('poster thumbnail', () => {
    it('renders artwork for a movie that has a poster', async () => {
      signInAdmin();
      api.listMovies.mockResolvedValue(
        page([movieFactory.build({ title: 'Dune', posterUrl: 'https://cdn.test/dune.jpg' })]),
      );

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

      const row = await screen.findByRole('row', { name: /Dune/ });
      expect(within(row).getByRole('presentation', { hidden: true })).toBeTruthy();
    });

    it('falls back to the generated tile when there is no poster', async () => {
      signInAdmin();
      api.listMovies.mockResolvedValue(
        page([movieFactory.build({ title: 'No Art', posterUrl: null })]),
      );

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

      // The fallback shows the initials, so a row is still identifiable.
      const row = await screen.findByRole('row', { name: /No Art/ });
      expect(within(row).getByText('NA')).toBeInTheDocument();
    });

    it('keeps the thumbnail out of the accessible name of the row', async () => {
      signInAdmin();
      api.listMovies.mockResolvedValue(
        page([movieFactory.build({ title: 'Heat', posterUrl: 'https://cdn.test/heat.jpg' })]),
      );

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

      // Decorative: the title is the label, the image must not repeat it.
      const row = await screen.findByRole('row', { name: /Heat/ });
      expect(within(row).queryByAltText(/Heat/)).not.toBeInTheDocument();
    });
  });

  it('marks drafts and published titles differently', async () => {
    signInAdmin();
    api.listMovies.mockResolvedValue(
      page([
        movieFactory.build({ title: 'Live', isPublished: true }),
        movieFactory.build({ title: 'Hidden', isPublished: false }),
      ]),
    );

    render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

    expect(await screen.findByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Unpublished')).toBeInTheDocument();
  });

  it('asks only for its own titles when a provider is signed in', async () => {
    signInProvider();

    render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

    await waitFor(() =>
      expect(api.listMovies).toHaveBeenCalledWith(
        expect.objectContaining({ mine: true }),
        expect.anything(),
      ),
    );
  });

  it('asks for the whole catalog when an admin is signed in', async () => {
    signInAdmin();

    render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

    await waitFor(() => expect(api.listMovies).toHaveBeenCalled());
    expect(api.listMovies.mock.calls[0]?.[0]).not.toHaveProperty('mine');
  });

  it("disables the actions on a movie the provider does not own", async () => {
    signInProvider();
    api.listMovies.mockResolvedValue(
      page([movieFactory.build({ title: 'Someone Elses', createdById: 'another-user' })]),
    );

    render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

    const row = await screen.findByRole('row', { name: /Someone Elses/ });
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(within(row).getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('enables the actions on the provider own movie', async () => {
    const providerId = signInProvider();
    api.listMovies.mockResolvedValue(
      page([movieFactory.build({ title: 'Mine', createdById: providerId })]),
    );

    render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

    const row = await screen.findByRole('row', { name: /Mine/ });
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeEnabled();
  });

  it('toggles the published state', async () => {
    signInAdmin();
    const movie = movieFactory.build({ title: 'Toggle Me', isPublished: false });
    api.listMovies.mockResolvedValue(page([movie]));
    api.setMoviePublished.mockResolvedValue({ ...movie, isPublished: true });
    const user = userEvent.setup();

    render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(api.setMoviePublished).toHaveBeenCalledWith(movie.id, true));
  });

  it('shows an empty state that matches the role', async () => {
    signInProvider();

    render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

    expect(await screen.findByText('You have not added a title yet')).toBeInTheDocument();
  });

  describe('deleting', () => {
    /** Two rows, so the table survives a deletion and we can assert on what is left. */
    async function renderWithTwo(): Promise<{ doomed: Movie; user: ReturnType<typeof userEvent.setup> }> {
      signInAdmin();
      const doomed = movieFactory.build({ title: 'Doomed', releaseYear: 1999 });
      api.listMovies.mockResolvedValue(page([doomed, movieFactory.build({ title: 'Survivor' })]));
      const user = userEvent.setup();

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      const row = await screen.findByRole('row', { name: /Doomed/ });
      await user.click(within(row).getByRole('button', { name: 'Delete' }));

      return { doomed, user };
    }

    it('asks before it deletes, naming the movie', async () => {
      await renderWithTwo();

      const dialog = screen.getByRole('alertdialog', { name: 'Delete this movie?' });
      expect(within(dialog).getByText('Doomed')).toBeInTheDocument();
      expect(within(dialog).getByText(/1999/)).toBeInTheDocument();
      expect(api.deleteMovie).not.toHaveBeenCalled();
    });

    it('backing out leaves the row alone', async () => {
      const { user } = await renderWithTwo();

      await user.click(screen.getByRole('button', { name: 'Keep it' }));

      expect(api.deleteMovie).not.toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByRole('row', { name: /Doomed/ })).toBeInTheDocument();
    });

    it('confirming removes the row', async () => {
      const { doomed, user } = await renderWithTwo();
      api.deleteMovie.mockResolvedValue(undefined);
      // The table refetches after a delete rather than splicing, so the server
      // is what decides which rows are left.
      api.listMovies.mockResolvedValue(page([movieFactory.build({ title: 'Survivor' })]));

      await user.click(screen.getByRole('button', { name: 'Delete movie' }));

      await waitFor(() => expect(api.deleteMovie).toHaveBeenCalledWith(doomed.id));
      await waitFor(() => expect(screen.queryByRole('row', { name: /Doomed/ })).not.toBeInTheDocument());
      expect(screen.getByRole('row', { name: /Survivor/ })).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('keeps the dialog open and readable when the delete fails', async () => {
      const { user } = await renderWithTwo();
      api.deleteMovie.mockRejectedValue(new Error('boom'));

      await user.click(screen.getByRole('button', { name: 'Delete movie' }));

      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/could not delete it/i);
      // The row is still there, and the button is right there to retry with.
      expect(screen.getByRole('row', { name: /Doomed/ })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Delete movie' })).toBeEnabled();
    });
  });


  describe('filtering and paging', () => {
    /** Waits out the search debounce without waiting out real time. */
    const flushDebounce = async (): Promise<void> => {
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
    };

    it('asks the server for the typed title, once', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      signInAdmin();
      api.listMovies.mockResolvedValue(page([movieFactory.build({ title: 'Dune' })]));

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      await act(async () => {});

      const callsBefore = api.listMovies.mock.calls.length;
      await user.type(screen.getByLabelText('Search titles'), 'dune');
      await flushDebounce();

      // Four keystrokes, one request — that is the whole point of the debounce.
      expect(api.listMovies.mock.calls.length).toBe(callsBefore + 1);
      expect(api.listMovies).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'dune', page: 1 }),
        expect.anything(),
      );
      jest.useRealTimers();
    });

    it('sends no search key at all when the box is empty', async () => {
      signInAdmin();

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

      await waitFor(() => expect(api.listMovies).toHaveBeenCalled());
      expect(api.listMovies.mock.calls[0]?.[0]).not.toHaveProperty('search');
    });

    it('translates the status filter into isPublished', async () => {
      const user = userEvent.setup();
      signInAdmin();

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      await waitFor(() => expect(api.listMovies).toHaveBeenCalled());

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'unpublished');
      await waitFor(() =>
        expect(api.listMovies).toHaveBeenLastCalledWith(
          expect.objectContaining({ isPublished: false }),
          expect.anything(),
        ),
      );

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'published');
      await waitFor(() =>
        expect(api.listMovies).toHaveBeenLastCalledWith(
          expect.objectContaining({ isPublished: true }),
          expect.anything(),
        ),
      );
    });

    it('drops isPublished again on "Any status"', async () => {
      const user = userEvent.setup();
      signInAdmin();

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      await waitFor(() => expect(api.listMovies).toHaveBeenCalled());

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'unpublished');
      await waitFor(() => expect(api.listMovies).toHaveBeenCalledTimes(2));
      await user.selectOptions(screen.getByLabelText('Filter by status'), 'all');

      await waitFor(() =>
        expect(api.listMovies.mock.calls.at(-1)?.[0]).not.toHaveProperty('isPublished'),
      );
    });

    it('offers the same words for the state as the buttons use for the action', async () => {
      signInAdmin();

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      await waitFor(() => expect(api.listMovies).toHaveBeenCalled());

      // Published/Unpublished for what a title *is*, Publish/Unpublish for what
      // you do to it. A third word ("Draft") for the same state was the bug.
      const status = screen.getByLabelText('Filter by status');
      expect(within(status).getByRole('option', { name: 'Any status' })).toBeInTheDocument();
      expect(within(status).getByRole('option', { name: 'Published' })).toBeInTheDocument();
      expect(within(status).getByRole('option', { name: 'Unpublished' })).toBeInTheDocument();
      expect(within(status).queryByRole('option', { name: 'Draft' })).not.toBeInTheDocument();
    });

    it('filters by genre', async () => {
      const user = userEvent.setup();
      signInAdmin();

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      await waitFor(() => expect(api.listMovies).toHaveBeenCalled());

      await user.selectOptions(screen.getByLabelText('Filter by genre'), 'HORROR');

      await waitFor(() =>
        expect(api.listMovies).toHaveBeenLastCalledWith(
          expect.objectContaining({ genre: 'HORROR' }),
          expect.anything(),
        ),
      );
    });

    it('goes back to page one whenever a filter changes', async () => {
      const user = userEvent.setup();
      signInAdmin();
      api.listMovies.mockResolvedValue({
        items: [movieFactory.build({ title: 'Dune' })],
        meta: { page: 3, pageSize: 10, totalItems: 40, totalPages: 4, hasNextPage: true, hasPreviousPage: true },
      });

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);

      await user.click(await screen.findByRole('button', { name: 'Next' }));
      await waitFor(() =>
        expect(api.listMovies).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 4 }),
          expect.anything(),
        ),
      );

      // Page 4 of the old query is meaningless once the query changes.
      await user.selectOptions(screen.getByLabelText('Filter by genre'), 'HORROR');
      await waitFor(() =>
        expect(api.listMovies).toHaveBeenLastCalledWith(
          expect.objectContaining({ genre: 'HORROR', page: 1 }),
          expect.anything(),
        ),
      );
    });

    it('keeps the search box mounted and focused while results reload', async () => {
      const user = userEvent.setup();
      signInAdmin();

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      await waitFor(() => expect(api.listMovies).toHaveBeenCalled());

      const box = screen.getByLabelText('Search titles');
      await user.type(box, 'du');

      // Losing focus mid-word is what an unmounted toolbar would cause.
      expect(box).toHaveFocus();
      expect(box).toHaveValue('du');
    });

    it('says the filters are what emptied the table, not the catalog', async () => {
      const user = userEvent.setup();
      signInAdmin();
      api.listMovies.mockResolvedValue(page([]));

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      expect(await screen.findByText('There are no titles yet')).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Filter by genre'), 'HORROR');

      expect(await screen.findByText('Nothing matches those filters')).toBeInTheDocument();
    });

    it('clears every filter at once', async () => {
      const user = userEvent.setup();
      signInAdmin();

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      await waitFor(() => expect(api.listMovies).toHaveBeenCalled());
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText('Filter by genre'), 'HORROR');
      await user.click(await screen.findByRole('button', { name: 'Clear filters' }));

      await waitFor(() => {
        const last = api.listMovies.mock.calls.at(-1)?.[0];
        expect(last).not.toHaveProperty('genre');
        expect(last).not.toHaveProperty('isPublished');
      });
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    });

    it('leaves the provider ownership filter alone', async () => {
      const user = userEvent.setup();
      signInProvider();

      render(<MovieAdminTable refreshToken={0} onEdit={jest.fn()} />);
      await waitFor(() => expect(api.listMovies).toHaveBeenCalled());

      await user.selectOptions(screen.getByLabelText('Filter by status'), 'unpublished');

      // A provider must never be able to filter their way into someone else's titles.
      await waitFor(() =>
        expect(api.listMovies).toHaveBeenLastCalledWith(
          expect.objectContaining({ mine: true, isPublished: false }),
          expect.anything(),
        ),
      );
    });
  });
});
