# fiberX Loyalty Dashboard

An administrative dashboard for the fiberX loyalty backend. Vue 3, TypeScript, Vite,
Pinia, Vue Router, Axios, Tailwind CSS and Vue I18n, bilingual (English / Arabic) with
full RTL support, light and dark themes, and permission-aware navigation.

## Running it

```bash
npm install
npm run dev            # http://localhost:5174
```

The backend must be running on its http endpoint:

```bash
# in the backend directory
dotnet run              # http://localhost:5030 (see Properties/launchSettings.json)
```

The dashboard calls the API directly at `http://localhost:5030`. That works because the
backend allows this origin in `appsettings.Development.json` → `Cors:AllowedOrigins`.

Use the **http** endpoint, not `https://localhost:7128` — the development HTTPS
certificate is self-signed, and a browser refuses an XHR to it until the certificate is
trusted (`dotnet dev-certs https --trust`).

The dev server pins port 5174 (`strictPort`), so it fails loudly rather than moving to
5175 and falling off the CORS allowlist.

Sign in with a backend administrator account (the bootstrap admin is configured by
`LOYALTY_BOOTSTRAP_ADMIN_EMAIL` / `LOYALTY_BOOTSTRAP_ADMIN_PASSWORD` in the backend's
`.env`).

```bash
npm run build          # type-check + production bundle into dist/
npm run preview        # serve the built bundle
npm run type-check     # vue-tsc only
```

## Configuration

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Absolute base URL of the backend, no trailing slash. Leave **empty** when the dashboard and API share a host — requests are then relative and need no CORS at all. |
| `VITE_DEV_API_TARGET` | Development only: where `npm run dev` proxies `/api`, used only when `VITE_API_BASE_URL` is empty. Defaults to `http://localhost:5030`. |

No secret, token or credential is committed. The bearer token lives in `localStorage`
at runtime and nowhere else.

### Two ways to reach the API

**Direct (the default).** `VITE_API_BASE_URL=http://localhost:5030`. The browser calls
the API cross-origin, which requires that origin to be listed in the backend's
`Cors:AllowedOrigins`. Development already lists `localhost:5174`.

**Through the proxy.** Leave `VITE_API_BASE_URL` empty. Every request becomes relative
and Vite forwards `/api` to `VITE_DEV_API_TARGET`, so everything is same-origin and no
CORS policy is involved. Useful against a backend whose allowlist you cannot change, and
it mirrors a production deployment that serves both behind one host.

### Deploying

Either serve the dashboard and the API behind one host — set `VITE_API_BASE_URL` empty,
and CORS never enters the picture — or serve them separately, set `VITE_API_BASE_URL` to
the API's public URL, and add the dashboard's origin to the backend's
`Cors:AllowedOrigins`. The shipped `appsettings.json` has that list **empty**, so a
deployed API refuses cross-origin browser calls until an origin is added deliberately.

## The logo

The brand palette (violet `#4A2B8C`, orange `#F26B3E`) is taken from the supplied
fiberX logo and drives the whole theme. The mark itself is rendered by one component,
[`src/components/layout/BrandLogo.vue`](src/components/layout/BrandLogo.vue), which
currently draws a wordmark built from those two brand colours.

**To install the real artwork**, save the supplied files as:

```
src/assets/logo-fiberx.svg      # Latin "fiberX" lockup      → used for English
src/assets/logo-fiberx-ar.svg   # Arabic "فايبر X" lockup     → used for Arabic
```

then set `USE_IMAGE_ASSET = true` in that component. Every screen — login, sidebar,
mobile drawer, empty states, 404 — renders the logo through it, so that one change
updates the entire application. The wrapper only ever constrains height, so the
artwork's own aspect ratio is preserved and cannot be stretched.

## Architecture

```
src/
├── api/              One Axios client + one module per backend area.
│                     Every call is unwrapped from the ApiResponse envelope and
│                     every failure is normalised before it reaches a component.
├── components/
│   ├── ui/           Base* primitives — button, input, select, modal, drawer,
│   │                 badge, alert, pagination, dropdown, tabs, skeleton,
│   │                 empty/error states, toast host, confirm dialog.
│   ├── tables/       BaseTable plus the shared transactions and vouchers tables.
│   ├── forms/        PermissionPicker.
│   ├── charts/       BarChart (plain DOM, theme- and RTL-aware).
│   └── layout/       Header, sidebar, breadcrumb, page header, brand logo.
├── composables/      useAsyncResource, usePagedResource, useApiError,
│                     usePermissions, useConfirm, useFormat.
├── layouts/          DashboardLayout, AuthLayout.
├── locales/          en.json, ar.json — 619 keys each, verified at parity.
├── pages/            One page per route, all lazy-loaded.
├── router/           Routes plus the session and permission guard.
├── stores/           auth, ui (theme/locale/sidebar), toast.
├── types/            api.ts (envelope) and models.ts (domain, transcribed from
│                     the backend DTOs).
└── utils/            format.ts (locale-aware), permissions.ts (the catalogue).
```

See [ENDPOINT-MATRIX.md](ENDPOINT-MATRIX.md) for every backend endpoint, the permission
it needs, the page that uses it, and — where one is not surfaced — why.

## Design decisions worth knowing

**The backend is the source of truth.** Types in `src/types/models.ts` are transcribed
from the C# DTOs, including places where the API is narrower than a dashboard might
wish. Where a field does not exist on the server it does not exist here, so a screen
cannot invent one.

**Authorization is UX only.** `usePermissions()` hides actions the caller would be
refused and the router redirects unreachable pages to a 403. The API re-checks every
request; nothing in the client is a security boundary. This was verified by creating an
administrator with only `Offers.Read` and confirming the backend refused all else.

**No fabricated data.** Dashboard KPIs come from real list endpoints. The two wallet
figures describe the fetched page and say so, because the API exposes no aggregate. No
time-series chart is shown, because nothing in the API can answer one.

**Subscription processing.** Only `userId` and `price` are required. Points are computed
server-side from `price`; the dashboard performs no arithmetic and reads no package rule.
The endpoint is not idempotent, so the page warns about it in both languages and
prevents accidental double submission by disabling submit while a request is in flight —
but it does no duplicate detection on `subscriptionId`.

**RTL is structural, not a stylesheet.** Layout uses logical properties (`ps`/`pe`,
`ms`/`me`, `start`/`end`) rather than left/right, so Arabic mirrors without a parallel
set of rules. Pagination arrows swap glyph by direction. Identifiers, codes, GUIDs,
prices and coordinates are pinned LTR even in Arabic, because they read wrongly mirrored.

**Theming is one palette, two definitions.** Colours are CSS variables redefined under
`.dark`, surfaced as Tailwind tokens (`bg-surface`, `text-content`, `border-hairline`).
Components need no `dark:` variant for colour alone. A small inline script in
`index.html` applies the stored theme and direction before first paint, so there is no
flash of the wrong theme.

## Verification performed

Checked against a live backend and a real Chrome instance:

- Production build: no TypeScript or Vue errors, every route lazy-loaded.
- All 18 pages render in English and Arabic with 0 console errors, 0 failed requests
  and 0 untranslated keys.
- No horizontal overflow at 390, 768, 1280, 1920 or 2560 px wide.
- Light and dark, LTR and RTL; Arabic renders in Tajawal.
- Login, session restore on reload, 401 handling, logout.
- Permission enforcement: an `Offers.Read`-only admin sees one nav item; the backend
  returned 403 for every other read and for both mutations attempted.
- CRUD through the UI: category created (list grew, success toast), validation errors
  bound to their fields, subscription awarded +2,000 points for a price of 100,000
  against a threshold of 50.
- Destructive actions use the custom dialog; `window.confirm` never fires.
