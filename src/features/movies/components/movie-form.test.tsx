import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as moviesApi from '@/features/movies/api/movies.api';
import { movieFactory } from '@/testing/factories/movie.factory';
import { MovieForm } from './movie-form';

jest.mock('@/features/movies/api/movies.api');

const api = moviesApi as jest.Mocked<typeof moviesApi>;

beforeAll(() => {
  // jsdom implements neither, and the poster preview needs both.
  URL.createObjectURL = jest.fn(() => 'blob:preview');
  URL.revokeObjectURL = jest.fn();
});

const fill = async (
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<Record<string, string>> = {},
): Promise<void> => {
  const values = { Title: 'Dune', Year: '2021', 'Runtime (min)': '155', ...overrides };

  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (value) await user.type(input, value);
  }
};

const submit = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: 'Add movie' }));
};

/** Reads a FormData argument back as a plain object. */
const sentPayload = (): Record<string, unknown> => {
  const [payload] = api.createMovieWithPoster.mock.calls[0] ?? [];
  return payload as unknown as Record<string, unknown>;
};

describe('MovieForm', () => {
  beforeEach(() => {
    api.createMovieWithPoster.mockResolvedValue(movieFactory.build({ title: 'Dune' }));
  });

  it('renders every field with a real label', () => {
    render(<MovieForm onSaved={jest.fn()} />);

    ['Title', 'Genre', 'Year', 'Runtime (min)'].forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Catalog rating/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Synopsis/)).toBeInTheDocument();
  });

  it('submits the typed values', async () => {
    const user = userEvent.setup();
    render(<MovieForm onSaved={jest.fn()} />);

    await fill(user);
    await submit(user);

    await waitFor(() => expect(api.createMovieWithPoster).toHaveBeenCalled());
    expect(sentPayload()).toMatchObject({
      title: 'Dune',
      releaseYear: 2021,
      durationMinutes: 155,
      genre: 'DRAMA',
    });
  });

  it('sends numbers as numbers, not strings', async () => {
    const user = userEvent.setup();
    render(<MovieForm onSaved={jest.fn()} />);

    await fill(user);
    await submit(user);

    await waitFor(() => expect(api.createMovieWithPoster).toHaveBeenCalled());
    expect(typeof sentPayload().releaseYear).toBe('number');
    expect(typeof sentPayload().durationMinutes).toBe('number');
  });

  it('defaults to unpublished and sends it as a real false', async () => {
    const user = userEvent.setup();
    render(<MovieForm onSaved={jest.fn()} />);

    await fill(user);
    await submit(user);

    await waitFor(() => expect(api.createMovieWithPoster).toHaveBeenCalled());
    // The API used to coerce a "false" string to true; this pins the payload.
    expect(sentPayload().isPublished).toBe(false);
  });

  it('publishes when the box is ticked', async () => {
    const user = userEvent.setup();
    render(<MovieForm onSaved={jest.fn()} />);

    await fill(user);
    await user.click(screen.getByLabelText(/Publish immediately/));
    await submit(user);

    await waitFor(() => expect(sentPayload().isPublished).toBe(true));
  });

  it('omits the optional fields when left blank', async () => {
    const user = userEvent.setup();
    render(<MovieForm onSaved={jest.fn()} />);

    await fill(user);
    await submit(user);

    await waitFor(() => expect(api.createMovieWithPoster).toHaveBeenCalled());
    expect(sentPayload()).not.toHaveProperty('synopsis');
    expect(sentPayload()).not.toHaveProperty('rating');
  });

  describe('validation before the request', () => {
    it('requires a title', async () => {
      const user = userEvent.setup();
      render(<MovieForm onSaved={jest.fn()} />);

      await fill(user, { Title: '' });
      await submit(user);

      expect(await screen.findByText('Title is required.')).toBeInTheDocument();
      expect(api.createMovieWithPoster).not.toHaveBeenCalled();
    });

    it('rejects a year outside the allowed range', async () => {
      const user = userEvent.setup();
      render(<MovieForm onSaved={jest.fn()} />);

      await fill(user, { Year: '1200' });
      await submit(user);

      expect(await screen.findByText(/Year must be between/)).toBeInTheDocument();
      expect(api.createMovieWithPoster).not.toHaveBeenCalled();
    });

    it('rejects a runtime of zero', async () => {
      const user = userEvent.setup();
      render(<MovieForm onSaved={jest.fn()} />);

      await fill(user, { 'Runtime (min)': '0' });
      await submit(user);

      expect(await screen.findByText(/Runtime must be between/)).toBeInTheDocument();
    });

    it('rejects a rating above 10', async () => {
      const user = userEvent.setup();
      render(<MovieForm onSaved={jest.fn()} />);

      await fill(user);
      await user.type(screen.getByLabelText(/Catalog rating/), '11');
      await submit(user);

      expect(await screen.findByText(/Rating must be between/)).toBeInTheDocument();
    });
  });

  describe('poster', () => {
    it('accepts a valid image and shows a preview', async () => {
      const user = userEvent.setup();
      render(<MovieForm onSaved={jest.fn()} />);

      const file = new File(['x'], 'poster.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText('Poster'), file);

      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('rejects a non-image file', async () => {
      const user = userEvent.setup();
      render(<MovieForm onSaved={jest.fn()} />);

      const file = new File(['x'], 'notes.pdf', { type: 'application/pdf' });
      await user.upload(screen.getByLabelText('Poster'), file);

      expect(await screen.findByText(/JPEG, PNG, WebP or AVIF/)).toBeInTheDocument();
    });

    it('passes the chosen file through to the API', async () => {
      const user = userEvent.setup();
      render(<MovieForm onSaved={jest.fn()} />);

      const file = new File(['x'], 'poster.png', { type: 'image/png' });
      await user.upload(screen.getByLabelText('Poster'), file);
      await fill(user);
      await submit(user);

      await waitFor(() => expect(api.createMovieWithPoster).toHaveBeenCalled());
      expect(api.createMovieWithPoster.mock.calls[0]?.[1]).toBe(file);
    });

    it('sends null when no poster was chosen', async () => {
      const user = userEvent.setup();
      render(<MovieForm onSaved={jest.fn()} />);

      await fill(user);
      await submit(user);

      await waitFor(() => expect(api.createMovieWithPoster).toHaveBeenCalled());
      expect(api.createMovieWithPoster.mock.calls[0]?.[1]).toBeNull();
    });
  });

  it('reports the created movie and clears the form', async () => {
    const user = userEvent.setup();
    const onSaved = jest.fn();
    render(<MovieForm onSaved={onSaved} />);

    await fill(user);
    await submit(user);

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dune' })),
    );
    expect(screen.getByLabelText('Title')).toHaveValue('');
  });

  it('surfaces a server error and keeps the values', async () => {
    const user = userEvent.setup();
    api.createMovieWithPoster.mockRejectedValue(new Error('boom'));
    render(<MovieForm onSaved={jest.fn()} />);

    await fill(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Dune');
  });

  describe('edit mode', () => {
    it('prefills every field from the movie', () => {
      const movie = movieFactory.build({
        title: 'Heat',
        releaseYear: 1995,
        durationMinutes: 170,
        genre: 'ACTION',
      });

      render(<MovieForm movie={movie} onSaved={jest.fn()} />);

      expect(screen.getByLabelText('Title')).toHaveValue('Heat');
      expect(screen.getByLabelText('Year')).toHaveValue(1995);
      expect(screen.getByLabelText('Runtime (min)')).toHaveValue(170);
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    });

    it('updates instead of creating', async () => {
      const user = userEvent.setup();
      const movie = movieFactory.build({ title: 'Heat' });
      api.updateMovie.mockResolvedValue({ ...movie, title: 'Heat (remaster)' });

      render(<MovieForm movie={movie} onSaved={jest.fn()} />);
      await user.clear(screen.getByLabelText('Title'));
      await user.type(screen.getByLabelText('Title'), 'Heat (remaster)');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() =>
        expect(api.updateMovie).toHaveBeenCalledWith(
          movie.id,
          expect.objectContaining({ title: 'Heat (remaster)' }),
        ),
      );
      expect(api.createMovieWithPoster).not.toHaveBeenCalled();
    });

    it('offers a cancel action', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();

      render(<MovieForm movie={movieFactory.build()} onSaved={jest.fn()} onCancel={onCancel} />);
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalled();
    });

    it('allows replacing the artwork', () => {
      render(<MovieForm movie={movieFactory.build()} onSaved={jest.fn()} />);

      expect(screen.getByLabelText('Poster')).toBeEnabled();
      expect(screen.getByText(/keep the current artwork/)).toBeInTheDocument();
    });

    it('previews the current poster before anything is picked', () => {
      const movie = movieFactory.build({ posterUrl: 'https://cdn.test/current.webp' });

      render(<MovieForm movie={movie} onSaved={jest.fn()} />);

      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.test/current.webp');
    });

    it('sends the file when one is chosen', async () => {
      const user = userEvent.setup();
      const movie = movieFactory.build();
      api.updateMovieWithPoster.mockResolvedValue(movie);
      const file = new File(['x'], 'new.png', { type: 'image/png' });

      render(<MovieForm movie={movie} onSaved={jest.fn()} />);
      await user.upload(screen.getByLabelText('Poster'), file);
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() =>
        expect(api.updateMovieWithPoster).toHaveBeenCalledWith(movie.id, expect.anything(), file),
      );
      expect(api.updateMovie).not.toHaveBeenCalled();
    });

    it('keeps the artwork when no file is chosen', async () => {
      const user = userEvent.setup();
      const movie = movieFactory.build();
      api.updateMovie.mockResolvedValue(movie);

      render(<MovieForm movie={movie} onSaved={jest.fn()} />);
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      // No multipart at all, which is what tells the API to leave it alone.
      await waitFor(() => expect(api.updateMovie).toHaveBeenCalled());
      expect(api.updateMovieWithPoster).not.toHaveBeenCalled();
    });

    it('keeps showing the stored poster when a bad file is rejected', async () => {
      const user = userEvent.setup();
      const movie = movieFactory.build({ posterUrl: 'https://cdn.test/current.webp' });

      render(<MovieForm movie={movie} onSaved={jest.fn()} />);
      await user.upload(
        screen.getByLabelText('Poster'),
        new File(['x'], 'bad.pdf', { type: 'application/pdf' }),
      );

      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.test/current.webp');
    });
  });
});
