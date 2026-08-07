/**
 * @jest-environment node
 */
import { apiClient } from '@/lib/api';
import {
  addToWatchlist,
  listWatchlist,
  removeFromWatchlist,
  updateWatchlistStatus,
} from './watchlist.api';

describe('watchlist.api', () => {
  let get: jest.SpyInstance;
  let post: jest.SpyInstance;
  let remove: jest.SpyInstance;

  beforeEach(() => {
    get = jest.spyOn(apiClient, 'get');
    post = jest.spyOn(apiClient, 'post');
    remove = jest.spyOn(apiClient, 'delete');
  });

  it('lists with no filters', async () => {
    get.mockResolvedValue({ items: [], meta: {} });

    await listWatchlist();

    expect(get).toHaveBeenCalledWith('/watchlist', expect.objectContaining({ query: {} }));
  });

  it('forwards the status filter', async () => {
    get.mockResolvedValue({ items: [], meta: {} });

    await listWatchlist({ status: 'WATCHED', pageSize: 100 });

    expect(get).toHaveBeenCalledWith(
      '/watchlist',
      expect.objectContaining({ query: { status: 'WATCHED', pageSize: 100 } }),
    );
  });

  it('omits status on add so the API applies its own default', async () => {
    post.mockResolvedValue({});

    await addToWatchlist('movie-1');

    expect(post).toHaveBeenCalledWith('/watchlist', { movieId: 'movie-1' });
  });

  it('sends an explicit status when given', async () => {
    post.mockResolvedValue({});

    await addToWatchlist('movie-1', 'WATCHED');

    expect(post).toHaveBeenCalledWith('/watchlist', { movieId: 'movie-1', status: 'WATCHED' });
  });

  it('addresses the entry by movieId on update', async () => {
    post.mockResolvedValue({});

    await updateWatchlistStatus('movie-1', 'WATCHING');

    expect(post).toHaveBeenCalledWith('/watchlist/movie-1', { status: 'WATCHING' });
  });

  it('url-encodes the id', async () => {
    remove.mockResolvedValue(undefined);

    await removeFromWatchlist('a b/c');

    expect(remove).toHaveBeenCalledWith('/watchlist/a%20b%2Fc');
  });
});
