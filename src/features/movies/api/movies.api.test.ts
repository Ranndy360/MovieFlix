/**
 * @jest-environment node
 */
import { apiClient } from '@/lib/api';
import { buildMoviePage } from '@/testing/factories/movie.factory';
import { movieFactory } from '@/testing/factories/movie.factory';
import {
  createMovie,
  deleteMovie,
  getMovie,
  listMovies,
  updateMovie,
} from './movies.api';

describe('movies.api', () => {
  let get: jest.SpyInstance;
  let post: jest.SpyInstance;
  let remove: jest.SpyInstance;

  // Re-created per test: `restoreMocks` in jest.config.ts tears spies down
  // after every case, so a describe-level `spyOn` would only work once.
  beforeEach(() => {
    get = jest.spyOn(apiClient, 'get');
    post = jest.spyOn(apiClient, 'post');
    remove = jest.spyOn(apiClient, 'delete');
  });

  it('lists movies with no filters', async () => {
    const page = buildMoviePage(2);
    get.mockResolvedValue(page);

    await expect(listMovies()).resolves.toBe(page);
    expect(get).toHaveBeenCalledWith('/movies', expect.objectContaining({ query: {} }));
  });

  it('forwards the filter object as query params', async () => {
    get.mockResolvedValue(buildMoviePage(0));

    await listMovies({ page: 2, search: 'dune', genre: 'SCI_FI' });

    expect(get).toHaveBeenCalledWith(
      '/movies',
      expect.objectContaining({ query: { page: 2, search: 'dune', genre: 'SCI_FI' } }),
    );
  });

  it('passes an abort signal through', async () => {
    const controller = new AbortController();
    get.mockResolvedValue(buildMoviePage(0));

    await listMovies({}, { signal: controller.signal });

    expect(get).toHaveBeenCalledWith(
      '/movies',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('sets a revalidate window only when asked', async () => {
    get.mockResolvedValue(buildMoviePage(0));

    await listMovies({}, { revalidate: 60 });
    expect(get).toHaveBeenCalledWith(
      '/movies',
      expect.objectContaining({ next: { revalidate: 60 } }),
    );

    await listMovies({});
    expect(get).toHaveBeenLastCalledWith(
      '/movies',
      expect.objectContaining({ next: undefined }),
    );
  });

  it('url-encodes the id in the detail path', async () => {
    get.mockResolvedValue(movieFactory.build());

    await getMovie('a b/c');

    expect(get).toHaveBeenCalledWith('/movies/a%20b%2Fc', expect.anything());
  });

  it('creates a movie', async () => {
    const movie = movieFactory.build();
    post.mockResolvedValue(movie);
    const payload = { title: 'Dune', genre: 'SCI_FI' as const, releaseYear: 2021, durationMinutes: 155 };

    await expect(createMovie(payload)).resolves.toBe(movie);
    expect(post).toHaveBeenCalledWith('/movies', payload);
  });

  it('updates a movie with a partial payload', async () => {
    const movie = movieFactory.build({ title: 'Renamed' });
    post.mockResolvedValue(movie);

    await expect(updateMovie(movie.id, { title: 'Renamed' })).resolves.toBe(movie);
    expect(post).toHaveBeenCalledWith(`/movies/${movie.id}`, { title: 'Renamed' });
  });

  it('deletes a movie', async () => {
    remove.mockResolvedValue(undefined);

    await expect(deleteMovie('abc')).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith('/movies/abc');
  });
});
