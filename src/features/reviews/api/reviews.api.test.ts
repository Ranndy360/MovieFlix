/**
 * @jest-environment node
 */
import { apiClient } from '@/lib/api';
import { getProfileStats } from '@/features/profile/api/profile.api';
import {
  createReview,
  deleteReview,
  listMyReviews,
  listReviews,
  updateReview,
} from './reviews.api';

describe('reviews.api', () => {
  let get: jest.SpyInstance;
  let post: jest.SpyInstance;
  let remove: jest.SpyInstance;

  beforeEach(() => {
    get = jest.spyOn(apiClient, 'get');
    post = jest.spyOn(apiClient, 'post');
    remove = jest.spyOn(apiClient, 'delete');
  });

  it('lists reviews for one movie', async () => {
    get.mockResolvedValue({ items: [], meta: {} });

    await listReviews({ movieId: 'movie-1', pageSize: 20 });

    expect(get).toHaveBeenCalledWith(
      '/reviews',
      expect.objectContaining({ query: { movieId: 'movie-1', pageSize: 20 } }),
    );
  });

  it('uses the dedicated route for my reviews', async () => {
    get.mockResolvedValue({ items: [], meta: {} });

    await listMyReviews();

    expect(get).toHaveBeenCalledWith('/reviews/me', expect.anything());
  });

  it('creates a review', async () => {
    post.mockResolvedValue({});

    await createReview({ movieId: 'movie-1', rating: 5, comment: 'Great' });

    expect(post).toHaveBeenCalledWith('/reviews', {
      movieId: 'movie-1',
      rating: 5,
      comment: 'Great',
    });
  });

  it('updates by review id, never movie id', async () => {
    post.mockResolvedValue({});

    await updateReview('review-1', { rating: 3 });

    expect(post).toHaveBeenCalledWith('/reviews/review-1', { rating: 3 });
  });

  it('deletes by review id', async () => {
    remove.mockResolvedValue(undefined);

    await deleteReview('review-1');

    expect(remove).toHaveBeenCalledWith('/reviews/review-1');
  });
});

describe('profile.api', () => {
  it('fetches the stats endpoint', async () => {
    const get = jest.spyOn(apiClient, 'get');
    get.mockResolvedValue({ totalWatched: 0 });

    await getProfileStats();

    expect(get).toHaveBeenCalledWith('/profile/stats', expect.anything());
  });
});
