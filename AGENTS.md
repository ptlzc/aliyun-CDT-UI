# AGENTS.md — aliyun-CDT Web Console

Operational and architectural contract for the frontend submodule (apps/web).

## Stack

React 19 + TypeScript 5.8 + Vite + Tailwind CSS 4 + TanStack Query 5 + react-router v7 + vitest 4 + Testing Library.

## Page structure (pages/)

- Every page lives in `src/pages/<Page>/index.tsx`.
- Page-private components live in `src/pages/<Page>/components/` and belong to that page only; cross-page imports of page-private components are forbidden.
- `src/components/` is reserved for components shared across pages: currently Sidebar, RegionGroupEditor, InstanceGovernanceDrawer, AuthPolicyModal.
- Shared helpers used by shared components live in `src/components/` too (e.g. `accountPolicy.ts`, the RAM policy document rendered by AuthPolicyModal).
- Page-private helpers (e.g. `instanceLabels.ts`) sit next to the page `index.tsx` and are subject to the same no-cross-page-import rule.
- The `@` alias maps directly to `src/`; use `@/lib/...`, `@/types`, etc. for cross-directory source imports (never `@/src/...`).

## Routing

- `src/router.tsx` is the single routing table (react-router v7, `createBrowserRouter`).
- `src/navigation.ts` is the single source of truth for `menuItems`; Sidebar and mobile drawer render from it, so menu entries cannot drift apart.
- Route inventory: `/dashboard`, `/accounts`, `/accounts/:accountId` (value `new` renders the create form), `/deployment`, `/instances`, `/workflows`, `/settings`; unknown paths redirect to `/dashboard`.
- The `/deployment` page is the one-click ECS deployment UI. It must keep the installer image format guidance consistent: Aliyun ECS does **not** support direct ISO import; installer images must be `raw`/`vhd`/`qcow2`/`vmdk` (Alpine virt/rescue installer images, not `.iso`). If the user only has an ISO, show that it must be converted first.
- `App.tsx` is the layout shell (Sidebar + `<Outlet/>` + InstanceGovernanceDrawer); it holds no page logic.

## Line limit

- Single source file ≤ 600 lines (blank lines and comments count).
- Exempt: `src/lib/api/generated.ts` and `src/lib/api/generated/**` (hey-api generated output, never hand-edited).
- Enforced by `npm run check:size`; when a file approaches the threshold (e.g. AccountDetailEditor at 575 lines), split it before adding more.

## Testing

- Test files live only in `__tests__/` directories, named `<thing>.test.tsx`.
- vitest 4 + Testing Library; run with `npm test`.

## Validation

All must pass before any completion claim:

```sh
npm test
npm run lint     # tsc --noEmit
npm run build    # vite build
npm run check:size
```

## API client

- `API_BASE_URL` (src/lib/api/client.ts) carries no `/api` prefix (default `http://localhost:8080`); huma spec operation paths already include `/api`, so the base URL must not duplicate it.
- Regenerate the client from a live backend: start `./scripts/dev.sh up`, then run `npm run generate:api`.
