# CLAUDE.md — MovieFlix (frontend)

Guidance for Claude Code (and humans) working in this repository.

## What this app is

MovieFlix's web client: a Next.js App Router application that renders the movie
catalog served by **MovieFlix-api** (the sibling NestJS project). It owns no
data of its own — every fact on screen comes from that API.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript (full `strict`) ·
Tailwind CSS v4 · Zustand 5 · Jest + Testing Library + `@faker-js/faker`.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev server | `npm run dev` → http://localhost:3000 |
| Production build | `npm run build` |
| Unit tests | `npm test` / `npm run test:cov` |
| Lint | `npm run lint` / `npm run lint:fix` |
| Typecheck | `npm run typecheck` |

**Before declaring any change done, run:** `npm run lint && npm run typecheck && npm test`.

The API must be running for real data: `npm run start:dev` in `../MovieFlix-api`
(port 3001). Without it the catalog renders its error state, which is correct
behavior, not a bug.

## Directory layout

```
src/
├── app/                       # App Router: routing, layouts, metadata ONLY
│   ├── layout.tsx  page.tsx  error.tsx  loading.tsx  not-found.tsx
│   ├── globals.css            # Tailwind v4 theme tokens (@theme)
│   └── movies/page.tsx
├── features/<feature>/        # a vertical slice, self-contained
│   ├── api/                   # typed resource functions
│   ├── components/
│   └── hooks/
├── lib/
│   ├── api/                   # THE HTTP boundary — see below
│   │   ├── http-client.ts  api-error.ts  endpoints.ts  index.ts
│   ├── utils/                 # pure helpers (cn, format)
│   └── env.ts                 # validated environment contract
├── store/                     # Zustand stores (client UI state only)
├── testing/                   # factories + fetch mocks (test-only)
└── types/api.ts               # wire types mirroring the API DTOs
```

Route files stay thin: metadata plus composition. Logic belongs in
`features/`, `lib/` or `store/`.

## The HTTP layer — the one rule that matters most

**Nothing outside `src/lib/api/` may call `fetch` against the backend.**

`HttpClient` (`src/lib/api/http-client.ts`) owns base-URL resolution, auth
headers, timeouts, retries, query serialization, JSON handling and error
translation. It runs unchanged in Server Components, Route Handlers and the
browser.

Layers, outermost first:

1. **`apiClient`** — the shared `HttpClient` instance. Import from `@/lib/api`.
2. **`features/<feature>/api/*.api.ts`** — typed functions per endpoint
   (`listMovies`, `createMovie`, …). Components call these, never `apiClient`.
3. **Components / hooks** — call the resource functions.

```ts
// features/movies/api/movies.api.ts
export function listMovies(query: MovieListQuery = {}): Promise<Paginated<Movie>> {
  return apiClient.get<Paginated<Movie>>(API_ENDPOINTS.movies.list, { query });
}
```

Adding an endpoint means: a path in `endpoints.ts`, a function in the feature's
`api/`, and wire types in `types/api.ts`. Never inline a URL string.

### Errors

Every failure rejects with **`ApiError`** — including network failures and
timeouts, which plain `fetch` reports as a `TypeError` or not at all. Branch on
it, never on message text:

```ts
try {
  await createMovie(payload);
} catch (error) {
  if (isApiError(error) && error.isValidation) {
    setFieldErrors(error.validationMessages); // flattened class-validator output
  } else if (isApiError(error) && error.kind === 'aborted') {
    return; // our own cancellation, not a failure
  } else {
    setError(isApiError(error) ? error.toDisplayMessage() : 'Something went wrong.');
  }
}
```

`ApiError` exposes `status`, `kind` (`network` | `timeout` | `aborted` |
`client` | `server` | `parse`), `isNotFound`, `isConflict`, `isValidation`,
`isUnauthorized`, `isRetryable`, `validationMessages` and `toDisplayMessage()`.
The `ApiErrorBody` interface mirrors the API's `AllExceptionsFilter` — if that
filter's shape changes, change this too.

### Retries and cancellation

- Idempotent methods (`GET`/`HEAD`/`OPTIONS`) retry retryable failures with
  exponential backoff; `POST`/`PATCH`/`PUT`/`DELETE` never retry by default.
  Override per call with `{ retries: n }` only when the endpoint is genuinely
  idempotent.
- Always pass an `AbortSignal` from effects. An aborted request surfaces as
  `kind === 'aborted'` and must be ignored, not shown to the user.

## Authentication

The API issues `httpOnly` cookies. **The frontend never sees, stores or sends a
token** — the browser attaches the cookies, which is why `apiClient` is built
with `withCredentials: true`.

### What lives where

| Thing | Where |
| --- | --- |
| Tokens | `httpOnly` cookies, invisible to JS by design |
| Current user profile | `useAuthStore` (memory only) |
| Session bootstrap | `AuthProvider` → `GET /auth/me` on mount |
| Silent renewal | `apiClient.setUnauthorizedHandler` → `POST /auth/refresh` |

**Do not persist the auth store.** Rehydrating a user from `localStorage` would
let the UI claim a session the cookies no longer back. `bootstrap()` asks the
server, which is the only component that actually knows.

### `status`, and why it is not a boolean

`AuthStatus` is `idle | loading | authenticated | unauthenticated`. Collapsing
it to `isLoggedIn` makes every protected page flash its signed-out state on
reload, because "not known yet" and "not signed in" become the same value.
Gate on `useIsAuthResolved()` before rendering anything role-dependent.

### Automatic refresh is single-flighted

When several requests 401 at once — the normal case for a page firing parallel
calls — they all await one `/auth/refresh`. This is correctness, not
optimization: refresh tokens rotate, so concurrent refreshes would invalidate
each other and trip the API's reuse detection, logging the user out entirely.

Auth endpoints pass `skipAuthRefresh: true`; a 401 there *is* the answer, and
retrying would loop.

### Role checks in the UI are cosmetic

`RequireRole`, `useRequireAuth` and `useHasRole` decide what to *render*. They
are not security: anyone can edit the JavaScript running on their own machine.
`src/middleware.ts` is the same story — it can only see whether a cookie is
*present*, since it deliberately does not hold the signing secret.

Every one of these is a UX affordance. The real boundary is `RolesGuard` on the
API, which re-reads the role from the database on each request. Never gate
anything that actually matters on the client.

```tsx
<RequireRole roles={['ADMIN']} pending={<Skeleton />}>
  <AdminNav />
</RequireRole>
```

Pass `pending` whenever a `fallback` is set, or under-privileged UI flashes for
authorized users during bootstrap.

### Signup sends no role

`RegisterPayload` has no `role` field on purpose. The API assigns `USER` and
rejects any request that carries a `role` property at all. Do not add one.

### Redirects

`?next=` is honoured only for paths starting with a single `/`. Absolute and
protocol-relative URLs fall back to `/movies` — otherwise the login page is an
open redirect that phishing can bounce a freshly-authenticated user through.

## Server vs Client Components

- **Server Component by default.** Add `'use client'` only for state, effects,
  event handlers or browser APIs.
- Push `'use client'` as far down the tree as possible. `app/movies/page.tsx` is
  a Server Component; only `MovieFiltersBar` and `MovieList` are client-side.
- Never import a store or a hook into a Server Component — that silently drags
  the whole subtree into the client bundle.
- Server-side data fetching goes straight through the resource functions; use
  `{ revalidate }` for Next's cache rather than a bespoke cache.

## State management

Three distinct kinds of state — do not mix them:

| Kind | Where it lives |
| --- | --- |
| Server data (movies, etc.) | Fetched where it is used (`useMovies`, or a Server Component) |
| Shared client UI state (filters, modals) | Zustand store in `src/store/` |
| Local component state | `useState` |

### The one sanctioned exception: `watchlist.store`

`useWatchlistStore` caches a `movieId → status` **index** of the caller's own
list. It breaks the rule above deliberately, because every poster tile, row and
hero button needs its own status and the alternatives are worse: one request
per card, or prop-drilling the list through the whole tree.

It stays honest by being small, scoped to one user, never the source of truth
for *content* (only for button state), optimistic with rollback on failure, and
**cleared on sign-out** — see `SiteHeader.handleSignOut`. Do not widen it into
a general server cache; reach for TanStack Query at that point.

**Zustand stores must not cache server data.** `movie-filters.store.ts` holds
what the user typed and picked; the movie list is fetched from those filters.
Two sources of truth for the same rows is how the UI ends up showing stale data.

Store conventions:

- Export **selector hooks** (`useMovieFilters`, `useMovieFilterActions`), not
  the raw store, so components subscribe to the narrowest slice.
- Object-returning selectors must use `useShallow`. Without it the selector
  returns a new object each render and every store change re-renders every
  subscriber.
- Actions live in the store and are stable references — safe in dependency arrays.
- Any filter change resets `page` to 1.
- Stores are module-level singletons and therefore **shared across requests on
  the server**. Never put per-user data in one; call `reset()` in test
  `beforeEach`.

## Design system — Netflix-style dark UI

**The app is dark only, on purpose.** A cinema UI wants a near-black canvas so
artwork carries the colour; supporting a light mode would mean a second set of
values for every scrim, gradient and poster overlay. `color-scheme: dark` is
set so native controls and scrollbars match.

Tokens live in `@theme` in `src/app/globals.css`:

| Token | Use |
| --- | --- |
| `base` `#141414` | page background |
| `surface` / `surface-2` / `surface-3` | cards, inputs, raised chips |
| `brand` `#e50914` | the action colour — **nothing else is red** |
| `content` / `content-muted` / `content-faint` | text hierarchy |
| `line` / `line-strong` | hairlines and outlined buttons |

Layout anatomy:

- **Header** is `fixed` and transparent over the hero, turning solid past 24px
  of scroll. Pages that do not start with a hero add their own `pt-24 md:pt-28`.
- **Hero billboard** carries two scrims (bottom-up and left-right) so title
  text stays legible over any artwork.
- **Rows** are native `overflow-x` + CSS scroll-snap, not a JS carousel:
  trackpad, touch and keyboard work for free, and the arrows are a progressive
  enhancement that hide at each end.
- **Detail modal** is the native `<dialog>` with `showModal()`. That buys focus
  trapping, Escape-to-close, page inertness and top-layer stacking without a
  hand-rolled focus trap. Do not replace it with a div.

### Artwork

`posterUrl` is nullable and remote URLs can 404 at runtime, so `MoviePoster`
handles both: a missing or failed image becomes a deterministic gradient keyed
to genre + title (`src/lib/utils/poster.ts`). Same movie, same tile, every
time — so the grid looks designed rather than broken. New remote image hosts
must be added to `images.remotePatterns` in `next.config.ts`.

### Motion

Hover-scale on cards and smooth row scrolling are both disabled under
`prefers-reduced-motion` in `globals.css`. Any new animation must respect it.

## Styling — Tailwind v4

- Tailwind v4 is configured **in CSS**, not `tailwind.config.js`. Design tokens
  are declared in `@theme` in `src/app/globals.css`; a `--color-brand-500` token
  automatically yields `bg-brand-500`, `text-brand-500`, etc.
- Use the semantic tokens (`surface`, `content`, `content-muted`, `line`,
  `brand-*`) rather than raw palette colors — dark mode is handled by
  re-declaring those tokens in one place.
- Compose classes with `cn()` from `@/lib/utils/cn` so a caller's `className`
  can override a component's defaults.
- No arbitrary values (`w-[137px]`) when a scale value exists.

## Accessibility

Non-optional, and cheap if done while writing the component:

- Every input has a real `<label htmlFor>`. Placeholders are not labels.
- Interactive elements are `<button>` / `<a>`, never a `div` with `onClick`.
- Loading regions get `aria-busy` and an `aria-label`; errors get `role="alert"`.
- Icon-only and value-only content gets an accessible name
  (see the rating badge in `movie-card.tsx`).
- Tests query by role and label — if a query is hard to write, the markup is
  usually the problem.

## Environment

- Declared and validated in `src/lib/env.ts` (zod), parsed at import time so a
  bad value fails immediately rather than at first request.
- **`NEXT_PUBLIC_*` is compiled into the browser bundle. Never put a secret
  behind that prefix.** Server-only values have no prefix.
- Next inlines `process.env.NEXT_PUBLIC_X` only for full literal property
  accesses — that is why `env.ts` spells each one out instead of looping.
- `env.apiBaseUrl` resolves per runtime: `API_BASE_URL` on the server (internal
  hostname in Docker), `NEXT_PUBLIC_API_BASE_URL` in the browser.
- Adding a variable means editing `env.ts`, `.env.example` and `jest.setup.ts`.

## Testing

Jest + Testing Library, with a coverage floor (70% statements/lines/functions,
65% branches).

### The rules

1. **Query the way a user would**: `getByRole`, `getByLabelText`, `getByText`.
   No `data-testid` unless there is genuinely no accessible handle.
2. **Test behavior, not implementation.** Never assert on state variables or
   internal function calls when a rendered outcome is observable.
3. **Build fixtures with factories.** `src/testing/factories/` mirrors the API
   factories: a complete valid object, with the test overriding only what it
   asserts on.
4. **Mock at the boundary.** For the HTTP client itself, mock `globalThis.fetch`
   (`src/testing/mock-fetch.ts`) so real serialization and status handling still
   run. For everything above it, mock the feature's `*.api.ts` module.
5. **Specs needing real `fetch`/`Response`/`Headers` must opt into Node** with a
   `@jest-environment node` docblock — jsdom implements none of them.
6. `restoreMocks` is on, so `jest.spyOn` belongs in `beforeEach`, not at
   describe level.
7. Reset Zustand stores in `beforeEach` — they are module singletons that leak
   between tests.

```ts
const movie = movieFactory.build({ title: 'Dune' });   // one, customized
const page = buildMoviePage(3, { hasNextPage: true }); // a coherent page
seedFaker();                                           // reproducible run
```

## Adding a feature — checklist

1. Wire types in `src/types/api.ts` matching the API's response DTO.
2. Paths in `src/lib/api/endpoints.ts`.
3. Resource functions in `src/features/<name>/api/<name>.api.ts`.
4. Components in `src/features/<name>/components/` — Server Components unless
   they need interactivity.
5. A Zustand store only if the state is shared **and** client-side.
6. A factory in `src/testing/factories/`.
7. Route file in `src/app/` that just composes the above.
8. Tests for the resource functions, the store and each component.
9. `npm run lint && npm run typecheck && npm test`.

## Gotchas

- `src/lib/env.ts` throws at **import** time. Any spec that transitively imports
  it needs the env vars set — that is what `jest.setup.ts` does.
- `next/jest` loads `.env.test` if present, but `jest.setup.ts` fills defaults so
  a missing file is not a failure.
- The API returns dates as ISO **strings**, not `Date` objects. `types/api.ts`
  reflects that; do not "fix" it to `Date`.
- Passing an object literal into `useMovies({ ... })` is safe — it serializes the
  query for the dependency array. Do not "optimize" that into the raw object;
  it will loop forever.
- Route shells under `src/app/**` are excluded from coverage on purpose; if you
  put logic in one, move the logic instead of changing the config.
- `no-restricted-imports` blocks deep relative paths (`../../../`). Use `@/`.
