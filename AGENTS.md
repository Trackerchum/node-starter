# AGENTS.md

Guidance for AI agents working in this repository.

## Project

node-starter - a starter for a  node project:

- **Backend**: TypeScript node app in `./`

Prefer matching the existing stack and folder layout once they exist. Do not introduce a second framework, bundler, or package manager without an explicit request.

## Cross-platform rules

- Contributors and agents may be on Windows, macOS, or Linux. Prefer `npm run <script>` wrappers and Node/npm tooling over raw shell that only works on one OS (`rm -rf`, `for /F`, bash arrays, PowerShell-only syntax, etc.).
- When adding root scripts, keep them cross-compatible (e.g. Node `fs.rmSync` for deletes in npm scripts, `docker compose -f docker-compose.development.yml down …` for project-scoped Docker cleanup, `npm run … --workspace=<name>` instead of `cd path && …`). Avoid shell-only deletes like `rm -rf` in root scripts — npm on Windows runs them via `cmd`, where that fails. Do not use global `docker system/container/image prune` in project scripts — those affect unrelated Docker resources on the host.
- Document commands in README/AGENTS with forms that work in PowerShell, cmd, and POSIX shells. Avoid assuming bash is available on the host.
- Container `command:` entries may use Linux `sh` — those run inside Linux images, not on the host.
- Do not add OS-specific scripts (`*.cmd` / `*.ps1` / bash-only) unless there is no portable alternative and the user asks for them.

## Clean, reusable code

- Prefer small, single-purpose modules over large "god" files.
- Extract shared domain types, validation, and pure helpers into reusable modules; keep UI and transport adapters thin.
- Avoid duplicating types between frontend and backend — share them when both need the same contract.
- Favor composition and clear interfaces over inheritance and clever abstractions.
- Name things by domain intent (`Product`, `Company`, `Order`), not by technical accident (`data`, `utils2`, `helper`).
- Keep side effects at the edges (HTTP handlers, DB access, UI event handlers). Business logic should be easy to unit test without Docker when possible.
- Do not add speculative abstractions "for later." Add reuse when a second real use case appears.

## TypeScript standards

- Strict TypeScript. Avoid `any`; prefer `unknown` and narrow it.
- Type-check your changes with `npm run typecheck` (or `npm run typecheck --workspace=<name>`) before considering them done. The build (`tsup`, `vite build`) and tests (`vitest`, `jest`) are transpile-only and do **not** catch type errors — only `tsc --noEmit` does. Each workspace has a `typecheck` script; keep the shared `tsconfig.json` files working so it stays that way.
- Model API contracts with explicit types/interfaces; keep request/response shapes consistent across client and server.
- Prefer discriminated unions and exhaustive checks for domain states over boolean flag soup.
- Handle errors intentionally: typed/domain errors on the backend, user-safe messaging on the frontend. No empty `catch` blocks.
- Document with JSDoc when you write code:
  - **Helpers**: exported utility/helper functions, static helper methods, and non-trivial module-private helpers (utils, shared helpers, validation helpers, pure formatters). Include a short description plus `@param` / `@returns` (and `@throws` when relevant).
  - **Types**: exported and domain `type` / `interface` declarations (including API DTOs, models, and non-trivial module-private domain shapes). Put a short description on the type itself and on each property/member. For string unions, document the meaning of each variant on the type.
  - Keep JSDoc accurate when you change behavior, signatures, fields, or meaning — update or remove stale docs in the same change. React components and typical component-prop types do not need JSDoc by default.

### Type file organization

- Every exported `type`/`interface` gets its own file, named exactly after it (`AggregateBuilder` → `AggregateBuilder.ts`). A file may hold at most one such declaration; it may still export any number of functions, classes, or consts alongside it (or alongside none).
- Keep types organized by domain/directory as today (`models/Product/`, `services/products/`, `api/product/`, etc.).
- Any directory that holds more than one file gets (or keeps) an `index.ts` barrel exporting everything in it — types, functions, classes, consts, components — so consumers import the directory (`from "./candidate"`), not individual files.
- Local (non-exported) types, and React prop types used only by their own component, are exempt.

<!-- ## Frontend

- Functional components and hooks; extract reusable hooks/components when logic or UI repeats.
- Keep presentational components free of data-fetching and routing details when practical.
- Style with SCSS (`.scss`); nest selectors by component/DOM structure rather than flat CSS descendant rules.
- Colocate component-specific styles with the component; test files go in a `_test/` directory beside it (see [Testing](#testing)).
- Accessibility and keyboard use matter for flows (forms, answer selection).
- All packages under `src/frontend/` must be mobile, tablet, and desktop ready. See [`src/frontend/AGENTS.md`](./src/frontend/AGENTS.md). -->

## Backend

- Clear layering: routes/controllers → services/domain → data access.
- Validate inputs at the boundary; never trust client payloads.
- Keep handlers thin; put reusable business rules in services or domain modules.
- Use structured logging; never log secrets or full PII.
- Put reusable backend clients, models, and helpers in `@../shared-backend` when a second backend app needs them (identity already does).

## Testing

- Test files do **not** sit next to the module they cover. Each directory that has tests gets a `__tests__/` subdirectory, and the test files live there: a module at `foo/bar/Baz.ts` is tested by `foo/bar/__tests__/Baz.test.ts`. This matches the Jest/Vitest/RTL-ecosystem convention.
- Keep the runner's naming convention: `*.test.ts` / `*.test.tsx` (Vitest). Both runners' default globs already pick up `__tests__/` subdirectories — do not add a new top-level `test/` root.
- Fix relative imports when moving a test into `__tests__/` (one extra `../` level); imports via path aliases (`@Shared/*`) and packages are unaffected.
- Run tests through the workspace script, e.g. `npm test --workspace=@../server`.

## Architecture decision records

Significant technical decisions are logged in [`ADR.md`](./ADR.md) at the repo root: a single-file log, newest entry at the bottom, each entry self-contained (Context → Decision → Consequences → Alternatives considered, with a Status of **Accepted** / **Superseded** / **Deprecated** / **Proposed**).

- Add a new ADR entry whenever you make a decision that is hard to reverse or shapes the codebase: adding, replacing, or dropping a framework, bundler, package manager, datastore, or runtime service; introducing a major dependency (e.g. auth, file handling, a test runner); establishing a cross-cutting pattern (auth model, error handling, state management, contract sharing); or changing the build, dev-loop, or deployment topology. A routine dependency bump or a bug fix is not an ADR.
- Follow the existing format and numbering: the next free `ADR-NNN`, **Status: Accepted**, appended at the bottom under the last entry (before "Open questions"). Keep the entry self-contained and cross-reference related ADRs by number.
- When a new decision reverses or replaces an older one, set the old entry's Status to **Superseded** (or **Deprecated**) and link the two — do not rewrite the superseded decision's reasoning.
- Keep the "Open questions / decisions not yet made" list current: remove an item when its ADR lands, add one when a decision is consciously deferred.
- This is in addition to the README / `AGENTS.md` updates below, not a replacement — `ADR.md` records *why* a choice was made; the READMEs and `AGENTS.md` record *what* the setup is and *how* to run it. Update all of them in the same change.

## Version control

- Do not create branches. Work on the currently checked-out branch unless the user explicitly asks for a new branch.
- Do not commit or push unless the user asks.

## Changes and docs

- Match existing naming, imports, and formatting.
- Limit diffs to the task; no drive-by refactors.
- Keep the docs accurate in the same change as the code. When you change commands, ports, env vars, stack choices, project purpose, endpoints, or how to run something, update every doc that describes it. Prefer short, clear wording; avoid inventing detail that is not yet true.
  - ADRs: [`ADR.md`](./ADR.md) — when the change is an architecturally significant decision (new/replaced/dropped technology or service, major dependency, cross-cutting pattern, build/dev/deploy topology), record it there per [Architecture decision records](#architecture-decision-records).
  - READMEs: the root [`README.md`](./README.md) and each package README — Update the root README for anything cross-cutting (stack, layout, running the full stack, shared env story); update the package README for anything specific to that package. A new package gets its own README following the existing ones.
  - AGENTS.md files: the root [`AGENTS.md`](./AGENTS.md). Keep guidance here consistent with what the READMEs describe; when a rule stated here stops matching reality, fix it rather than leaving it stale.
- Update Compose docs the same way when Compose workflows change.
- When changing helpers, types, or their properties/signatures, update the matching JSDoc in the same change (see TypeScript standards).
- Do not commit `.env`, credentials, or generated secrets.
