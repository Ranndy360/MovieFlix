import { faker } from '@faker-js/faker';

import { defineFactory } from '../factory';
import { MOVIE_GENRES, type Movie, type Paginated, type PaginationMeta } from '@/types/api';

export const movieFactory = defineFactory<Movie>(() => {
  const createdAt = faker.date.past({ years: 2 });

  return {
    id: faker.string.uuid(),
    title: faker.music.songName(),
    synopsis: faker.lorem.paragraph(),
    genre: faker.helpers.arrayElement(MOVIE_GENRES),
    releaseYear: faker.number.int({ min: 1950, max: 2026 }),
    durationMinutes: faker.number.int({ min: 70, max: 210 }),
    rating: Number(faker.number.float({ min: 0, max: 10, fractionDigits: 1 }).toFixed(1)),
    posterUrl: faker.image.urlLoremFlickr({ category: 'cinema' }),
    isPublished: true,
    createdById: null,
    createdAt: createdAt.toISOString(),
    updatedAt: faker.date.between({ from: createdAt, to: new Date() }).toISOString(),
  };
});

export const paginationMetaFactory = defineFactory<PaginationMeta>(() => ({
  page: 1,
  pageSize: 12,
  totalItems: 12,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}));

/** A full `Paginated<Movie>` page with coherent metadata. */
export const buildMoviePage = (
  count = 3,
  metaOverrides: Partial<PaginationMeta> = {},
): Paginated<Movie> => {
  const items = movieFactory.buildMany(count);

  return {
    items,
    meta: paginationMetaFactory.build({
      totalItems: count,
      pageSize: Math.max(count, 1),
      ...metaOverrides,
    }),
  };
};
