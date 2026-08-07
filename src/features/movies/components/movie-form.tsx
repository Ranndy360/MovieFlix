'use client';

import { useRef, useState } from 'react';

import { isApiError } from '@/lib/api';
import { FeedbackMessage } from '@/components/ui/feedback-message';
import { cn } from '@/lib/utils/cn';
import {
  GENRE_LABELS,
  MOVIE_GENRES,
  type CreateMoviePayload,
  type Movie,
  type MovieGenre,
} from '@/types/api';
import { createMovieWithPoster, updateMovie, updateMovieWithPoster } from '../api/movies.api';

/** Mirrors the API so the user is not told "invalid" only after a round trip. */
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1888;
const MAX_YEAR = 2100;
const MAX_POSTER_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

interface FieldErrors {
  title?: string;
  releaseYear?: string;
  durationMinutes?: string;
  rating?: string;
  poster?: string;
}

const FIELD_CLASS =
  'w-full rounded-sm border border-line bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-content-faint focus:border-white';

export interface MovieFormProps {
  /** Present in edit mode. The form is otherwise identical. */
  movie?: Movie;
  onSaved: (movie: Movie) => void;
  onCancel?: () => void;
}

export function MovieForm({ movie, onSaved, onCancel }: MovieFormProps): React.JSX.Element {
  const isEdit = movie !== undefined;

  const [values, setValues] = useState({
    title: movie?.title ?? '',
    genre: (movie?.genre ?? 'DRAMA') as MovieGenre,
    releaseYear: String(movie?.releaseYear ?? CURRENT_YEAR),
    durationMinutes: movie ? String(movie.durationMinutes) : '',
    rating: movie?.rating !== undefined ? String(movie.rating) : '',
    synopsis: movie?.synopsis ?? '',
    isPublished: movie?.isPublished ?? false,
  });

  const [poster, setPoster] = useState<File | null>(null);
  // In edit mode this starts as the stored URL and becomes an object URL
  // once a replacement is chosen.
  const [posterPreview, setPosterPreview] = useState<string | null>(movie?.posterUrl ?? null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]): void =>
    setValues((current) => ({ ...current, [key]: value }));

  /** Only object URLs may be revoked — the stored poster is a remote URL. */
  function releasePreview(url: string | null): void {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  }

  function handlePoster(file: File | null): void {
    // Revoking matters: each object URL pins the whole file in memory.
    releasePreview(posterPreview);

    if (!file) {
      setPoster(null);
      setPosterPreview(movie?.posterUrl ?? null);
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFieldErrors((e) => ({ ...e, poster: 'Use a JPEG, PNG, WebP or AVIF image.' }));
      setPoster(null);
      setPosterPreview(null);
      return;
    }

    if (file.size > MAX_POSTER_BYTES) {
      setFieldErrors((e) => ({ ...e, poster: 'The image must be 10MB or smaller.' }));
      setPoster(null);
      setPosterPreview(null);
      return;
    }

    setFieldErrors((e) => ({ ...e, poster: undefined }));
    setPoster(file);
    setPosterPreview(URL.createObjectURL(file));
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const year = Number(values.releaseYear);
    const minutes = Number(values.durationMinutes);
    const rating = values.rating === '' ? undefined : Number(values.rating);

    if (!values.title.trim()) errors.title = 'Title is required.';
    if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
      errors.releaseYear = `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`;
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1000) {
      errors.durationMinutes = 'Runtime must be between 1 and 1000 minutes.';
    }
    if (rating !== undefined && (Number.isNaN(rating) || rating < 0 || rating > 10)) {
      errors.rating = 'Rating must be between 0 and 10.';
    }

    return errors;
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setServerError(null);

    const errors = { ...validate(), ...(fieldErrors.poster ? { poster: fieldErrors.poster } : {}) };
    setFieldErrors(errors);
    if (Object.keys(errors).some((k) => errors[k as keyof FieldErrors])) return;

    setIsSubmitting(true);

    const payload: CreateMoviePayload = {
      title: values.title.trim(),
      genre: values.genre,
      releaseYear: Number(values.releaseYear),
      durationMinutes: Number(values.durationMinutes),
      isPublished: values.isPublished,
      ...(values.synopsis.trim() ? { synopsis: values.synopsis.trim() } : {}),
      ...(values.rating !== '' ? { rating: Number(values.rating) } : {}),
    };

    try {
      // A file is only sent when one was picked: omitting it is what keeps the
      // existing artwork on an edit.
      const saved = isEdit
        ? poster
          ? await updateMovieWithPoster(movie.id, payload, poster)
          : await updateMovie(movie.id, payload)
        : await createMovieWithPoster(payload, poster);

      if (!isEdit) {
        releasePreview(posterPreview);
        setValues({
          title: '',
          genre: 'DRAMA',
          releaseYear: String(CURRENT_YEAR),
          durationMinutes: '',
          rating: '',
          synopsis: '',
          isPublished: false,
        });
        setPoster(null);
        setPosterPreview(null);
        if (fileInput.current) fileInput.current.value = '';
      }

      onSaved(saved);
    } catch (cause) {
      setServerError(
        isApiError(cause)
          ? cause.toDisplayMessage()
          : `Could not ${isEdit ? 'update' : 'create'} the movie.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const error = (key: keyof FieldErrors): React.JSX.Element | null =>
    fieldErrors[key] ? (
      <p id={`movie-${key}-error`} className="text-xs text-brand">
        {fieldErrors[key]}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 md:grid-cols-[1fr_240px]">
      <div className="space-y-4">
        {serverError ? (
          <FeedbackMessage tone="error" title="We could not save this title">
            {serverError}
          </FeedbackMessage>
        ) : null}

        <div className="space-y-1">
          <label htmlFor="movie-title" className="block text-sm font-medium text-content-muted">
            Title
          </label>
          <input
            id="movie-title"
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? 'movie-title-error' : undefined}
            className={FIELD_CLASS}
          />
          {error('title')}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="movie-genre" className="block text-sm font-medium text-content-muted">
              Genre
            </label>
            <select
              id="movie-genre"
              value={values.genre}
              onChange={(e) => set('genre', e.target.value as MovieGenre)}
              className={FIELD_CLASS}
            >
              {MOVIE_GENRES.map((g) => (
                <option key={g} value={g}>
                  {GENRE_LABELS[g]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="movie-year" className="block text-sm font-medium text-content-muted">
              Year
            </label>
            <input
              id="movie-year"
              type="number"
              inputMode="numeric"
              value={values.releaseYear}
              onChange={(e) => set('releaseYear', e.target.value)}
              aria-invalid={Boolean(fieldErrors.releaseYear)}
              aria-describedby={fieldErrors.releaseYear ? 'movie-releaseYear-error' : undefined}
              className={FIELD_CLASS}
            />
            {error('releaseYear')}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="movie-duration"
              className="block text-sm font-medium text-content-muted"
            >
              Runtime (min)
            </label>
            <input
              id="movie-duration"
              type="number"
              inputMode="numeric"
              value={values.durationMinutes}
              onChange={(e) => set('durationMinutes', e.target.value)}
              aria-invalid={Boolean(fieldErrors.durationMinutes)}
              aria-describedby={
                fieldErrors.durationMinutes ? 'movie-durationMinutes-error' : undefined
              }
              className={FIELD_CLASS}
            />
            {error('durationMinutes')}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="movie-rating" className="block text-sm font-medium text-content-muted">
            Catalog rating (0–10, optional)
          </label>
          <input
            id="movie-rating"
            type="number"
            step="0.1"
            value={values.rating}
            onChange={(e) => set('rating', e.target.value)}
            aria-invalid={Boolean(fieldErrors.rating)}
            aria-describedby={fieldErrors.rating ? 'movie-rating-error' : undefined}
            className={cn(FIELD_CLASS, 'sm:w-40')}
          />
          <p className="text-xs text-content-faint">
            Editorial score, separate from the 1–5 stars users give in reviews.
          </p>
          {error('rating')}
        </div>

        <div className="space-y-1">
          <label htmlFor="movie-synopsis" className="block text-sm font-medium text-content-muted">
            Synopsis (optional)
          </label>
          <textarea
            id="movie-synopsis"
            rows={4}
            maxLength={5000}
            value={values.synopsis}
            onChange={(e) => set('synopsis', e.target.value)}
            className={cn(FIELD_CLASS, 'resize-y')}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isPublished}
            onChange={(e) => set('isPublished', e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand)]"
          />
          <span>Publish immediately</span>
          <span className="text-xs text-content-faint">
            (unpublished titles stay out of the catalog)
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-sm bg-brand px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add movie'}
          </button>

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-sm border border-line-strong px-6 py-2.5 text-sm font-semibold text-content-muted transition-colors hover:border-white hover:text-white disabled:opacity-60"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="movie-poster" className="block text-sm font-medium text-content-muted">
          Poster
        </label>

        <div className="aspect-[2/3] w-full overflow-hidden rounded-card border border-dashed border-line bg-surface-2">
          {posterPreview ? (
            // Either a local object URL or the movie's stored poster; neither is
            // worth routing through next/image for a form preview.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterPreview} alt="Poster preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-xs text-content-faint">
              No image — a gradient is generated from the title
            </div>
          )}
        </div>

        <input
          ref={fileInput}
          id="movie-poster"
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => handlePoster(e.target.files?.[0] ?? null)}
          aria-describedby={fieldErrors.poster ? 'movie-poster-error' : 'movie-poster-help'}
          className="w-full text-xs text-content-muted file:mr-3 file:rounded-sm file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
        />
        <p id="movie-poster-help" className="text-xs text-content-faint">
          JPEG, PNG, WebP or AVIF, up to 10MB. Resized and re-encoded to WebP on upload.
          {isEdit ? ' Leave empty to keep the current artwork.' : ''}
        </p>
        {error('poster')}
      </div>
    </form>
  );
}
