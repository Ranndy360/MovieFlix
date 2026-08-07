# MovieFlix

MovieFlix is a project to manage movies like Netflix — this is the web frontend.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · Zustand 5 · Jest + Testing Library + faker.

## Quick start

```bash
npm install
cp .env.example .env.local     # already provided with working local values
npm run dev                    # http://localhost:3000
```

The catalog needs the backend running:

```bash
cd ../MovieFlix-api
npm run db:up && npm run db:migrate && npm run db:seed
npm run start:dev              # http://localhost:3001
```

Without it the movies page renders its error state — that is the intended
behavior, not a crash.

## Scripts

```bash
npm run dev            # dev server
npm run build          # production build
npm start              # serve the build

npm test               # unit tests
npm run test:cov       # + coverage (thresholds enforced)

npm run lint           # eslint (flat config)
npm run typecheck      # tsc --noEmit
npm run format         # prettier
```

## Layout

```
src/
├── app/          App Router routes, layouts and global CSS
├── features/     vertical slices (movies/ is the reference implementation)
│   └── movies/   api/ · components/ · hooks/
├── lib/
│   ├── api/      HTTP client, ApiError, endpoint map  ← all backend traffic
│   ├── utils/    pure helpers
│   └── env.ts    validated environment contract
├── store/        Zustand stores (client UI state only)
├── testing/      factories and fetch mocks
└── types/api.ts  wire types mirroring the API DTOs
```

## Talking to the backend

All HTTP goes through `src/lib/api`. Components never call `fetch` directly.

```ts
import { listMovies, createMovie } from '@/features/movies/api/movies.api';
import { isApiError } from '@/lib/api';

const page = await listMovies({ page: 1, genre: 'SCI_FI' });

try {
  await createMovie({ title: 'Dune', genre: 'SCI_FI', releaseYear: 2021, durationMinutes: 155 });
} catch (error) {
  if (isApiError(error) && error.isValidation) {
    console.error(error.validationMessages);
  }
}
```

`HttpClient` handles base URLs, auth headers, query serialization, timeouts,
retries on idempotent methods, cancellation and JSON parsing, and converts every
failure — including network errors and timeouts — into a typed `ApiError`.

## Authentication

Sign in at `/login` or create an account at `/signup`. Sessions are `httpOnly`
cookies issued by the API — the frontend never handles a token.

Seeded logins (see `MovieFlix-api`): `admin@movieflix.test` / `Admin123!Change`,
`provider@movieflix.test` / `Provider123!Change`, `user@movieflix.test` /
`User123!Change`.

| Route | What |
| --- | --- |
| `/` | Netflix-style home: hero billboard + genre carousels |
| `/movies` | browse grid with search, genre filter and sorting |
| `/my-list` | your watchlist, grouped by status (signed in) |
| `/profile` | personal stats and session controls (signed in) |
| `/login`, `/signup` | signed-out only |
| `/admin/users` | role administration (ADMIN) |

Clicking any tile opens a detail modal where you can set the watchlist status
and — once the movie is marked watched — leave, edit or delete a 1–5 star
review.

New signups always get the `USER` role; an admin promotes them from
`/admin/users`.

Client-side role checks (`RequireRole`, `useRequireAuth`, `middleware.ts`) only
decide what to render — the API enforces access on every request.

## Environment

Validated in `src/lib/env.ts`; the app fails fast on a bad value. See
`.env.example` for the annotated list. `.env.local` ships with working defaults.

`NEXT_PUBLIC_*` values are compiled into the browser bundle — never put a
secret behind that prefix.

## Conventions

See [CLAUDE.md](CLAUDE.md) for the full engineering guide: the HTTP boundary,
Server vs Client Components, state-management boundaries, Tailwind v4 theming,
accessibility rules and the factory-based testing approach.
