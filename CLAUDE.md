# CLAUDE.md

Orientation notes for Claude Code working in this repo. Read this before making non-trivial changes.

## What this app is

Electron desktop app for managing a personal program library (games, tools) with Steam integration. Renderer is Vue 3 + Naive UI; main process handles filesystem, image processing (sharp), Steam discovery, and Windows icon extraction.

## Build & dev

- `npm run dev` — electron-vite dev (renderer HMR + Electron process).
- `npm run build` — `vue-tsc -b` typecheck, then electron-vite build into `out/`.
- `npm run build:win` / `build:dir` / `build:portable` — electron-builder targets.
- Typecheck alone: `npx vue-tsc -b`.
- There is **no test suite** and **no linter config** in the repo. Don't fabricate commands.

When you change UI, start the dev server and verify in the browser/Electron window before reporting done. Type checking only catches type errors, not UX bugs.

## Three-process layout

```
electron/main.ts          ── main process (Node)
electron/preload/index.ts ── contextBridge → window.electron
src/**                    ── renderer (Vue 3 sandboxed)
```

- `contextIsolation: true`, `sandbox: false`, `nodeIntegration: false`. The renderer has **no** direct Node access — everything goes through `window.electron.*` defined in preload.
- The preload duplicates a few types from `src/types` (there's no bundled shared module). When you change an IPC signature, update **three** places: preload, main IPC handler, and `src/types/ElectronAPI`.

## IPC contract

Handlers live in `electron/main.ts` `registerIpcHandlers()`. Channel names use `namespace:action` (e.g. `thumbnail:save`, `steam:downloadThumbnail`). All handlers are `ipcMain.handle` / `ipcRenderer.invoke` (request/response).

Notable groupings:

- `library:*`, `program:*` — `dataService`
- `thumbnail:*`, `icon:*` — `thumbnailService` / `iconService`
- `image:*` — `imageService` (read-as-data-url, URL fetch, temp buffer write)
- `steam:*` — `steamService` + partial dataService orchestration
- `window:*` — frameless window controls
- `settings:*` — settings persistence

## Data model

`Program` is the single entity (`src/types/index.ts`):

```ts
{
  id, title, executablePath,
  iconPath: string | null,          // userData-relative, e.g. "icons/<id>.webp"
  thumbnailPath: string | null,     // "thumbnails/<id>.webp"
  category: 'local' | 'steam',      // ProviderId; not user-editable
  tags: string[],
  createdAt, updatedAt              // ISO strings
}
```

Stored in `userData/library.json` (atomic write via `.tmp` + rename). `dataService.migrateProgram` normalizes legacy absolute paths into `userData`-relative paths on load, dropping any path that escapes the userData root. Don't bypass it.

## Image pipeline

All user-facing covers and icons are normalized through `sharp` in `imageService.ts`:

- Thumbnails → `600x900` WebP, `cover` fit, `position: centre`.
- Icons → `256x256` WebP, same fit.
- Output filename is always `<programId>.webp`. `cleanupLegacyFiles(dir, id)` removes any prior `<id>.*` (e.g. legacy `.jpg` written by older Steam code path) before writing.
- Source can be an absolute file path or a `Buffer`.

Flows that produce a source path that feeds into the pipeline:

1. OS file picker (`dialog:selectImage`) — absolute path.
2. Drag & drop — `webUtils.getPathForFile` in preload returns absolute path.
3. URL fetch (`image:fetchFromUrl`) — downloads to temp `wl-fetch-<uuid>.bin`.
4. Crop dialog output (`image:writeTempBuffer`) — canvas PNG bytes written to temp.

Temp files with the `wl-fetch-` prefix are cleaned on app start (`cleanupTempImages`).

## wl-image:// protocol

Renderer cannot load `file://` for local images because `webSecurity: true` and CSP. `main.ts` registers a privileged scheme `wl-image` that serves files under `userData/`:

- URL shape: `wl-image://lib/<relPath>?v=<cacheBuster>`
- Host must be `lib`; any `..` in the path is rejected; resolved absolute must stay inside `userData`.
- `libImageUrl(relPath, version)` in `src/types/index.ts` builds the URL. Always pass a version (`program.updatedAt` or a `Date.now()` bump) so the browser doesn't cache a stale image when a file at the same path is replaced.

## Steam integration

`steamService.ts`:

- Finds Steam via `HKCU\Software\Valve\Steam` (PowerShell `Get-ItemProperty`), falling back to `C:\Program Files (x86)\Steam` and `C:\Program Files\Steam`.
- Enumerates libraries from `<steam>/steamapps/libraryfolders.vdf` and parses each `appmanifest_*.acf` with regex (no VDF library dependency — it's only a few fields).
- Covers: downloads one of several CDN candidates (`library_600x900_2x.jpg` → `header.jpg`) and runs through `processThumbnail` to produce the standard WebP.
- Icons: pulls from `<steam>/appcache/librarycache/<appid>/...` (new layout) or `<appid>_*.{jpg,png,webp}` (legacy). ICO files are intentionally excluded — sharp's ICO support is spotty.
- Steam program's `executablePath` is `steam://run/<appId>` (a protocol URL). `fileService.launchProgram` dispatches to `shell.openExternal` for `^[a-z][a-z0-9+.-]*://` paths and `shell.openPath` otherwise.

## Edit dialog save flow (has a known pitfall)

`EditProgramDialog.vue` defers thumbnail/icon writes to `handleSubmit`. The init watch watches `[props.show, props.program]` and resets form state from the current program.

**Pitfall**: `libraryStore.updateProgram` replaces `programs.value[index]` with a new object reference. That triggers the init watch mid-submit, which **resets `thumbnailPath.value` back to the stored path**. If you read `thumbnailChanged.value` after the await, it reads `false` and the save is silently skipped.

Fix already in place: `handleSubmit` snapshots `pendingThumb` and `pendingIcon` **before** the `await updateProgram` call. Keep this pattern — don't reorder it or read the refs after the store mutation. Same applies to any future deferred save on that dialog.

## Stores (Pinia, setup-style)

- `libraryStore` — single source of truth for programs. Getters: `filteredPrograms`, `allTags`, `programCount`, `filteredCount`. Mutations are awaited IPC roundtrips (`addProgram`, `updateProgram`, etc.) that update the reactive array.
  - `filteredPrograms` computes `[...programs.value]` then filters/sorts — it creates a **new array with the same element refs**. Mutating a property on a program object (e.g. `program.thumbnailPath = X`) won't dirty `filteredPrograms` (filter/sort only read title/category/tags/createdAt). Downstream card components individually track the props they read. Don't "fix" this by replacing array elements on every mutation; it causes unnecessary re-renders.
- `settingsStore` — theme/viewMode/language, each action auto-saves. `applyLanguage` also writes through to `i18n.global.locale.value` so vue-i18n reacts.

## Theming

- Sakura Rose palette; dark uses `#e87ea1`, light uses `#db2777` as primary.
- `light-theme` class is applied on `.app-container`. CSS is written as `.light-theme .foo { ... }` next to the dark defaults.
- **Gotcha**: Naive UI modals teleport to `<body>` by default, so `.light-theme` doesn't reach modal descendants via DOM inheritance. Use `useThemeClass()` on a wrapper div inside any modal to re-apply the class locally. Existing dialogs already do this.

## i18n

- Locales in `src/i18n/locales/{ko,en,ja,zh-CN}.ts`. Default `ko`, fallback `en`.
- `detectInitialLocale()` reads `navigator.language` and maps to one of four; unknown → `ko`.
- Keys are flat-namespaced (`header.searchPlaceholder`, `editDialog.title`). **Every new UI string must be added to all four locale files** — there's no missing-key check at build time.
- Provider labels reference i18n via `PROVIDERS[id].labelKey`; don't hardcode Korean strings for providers.

## Frameless window

`frame: false` in `BrowserWindow`. `TitleBar.vue` is the custom drag region + min/max/close controls. Drag region uses `-webkit-app-region: drag`; buttons override with `no-drag`. `window:*` IPC handlers wire the controls to the main process.

## Security posture (current state)

A full review lives at `docs/reviews/SECURITY_STABILITY_REVIEW_2026-04-19.md`. When touching relevant areas, read it first. Notable outstanding items as of that review:

- IconService interpolates `executablePath` into a PowerShell script literal. It now passes paths via env vars (`WL_EXE_PATH`, `WL_OUT_PATH`) — **do not revert to string interpolation**.
- `dataService.deleteProgram` resolves stored paths against `getIconsPath()` / `getThumbnailsPath()` with an `isPathInside` check before `unlink`. Any new code that deletes user files must do the same.
- `wl-image://` enforces `host === 'lib'`, rejects `..`, and verifies the resolved absolute stays inside userData. Keep it that way.
- `fetchImageFromUrl` rejects non-http(s), non-image content-types, and payloads above 20 MB. Keep the size/scheme checks.

## Logging

- `electron/services/logger.ts` wraps `electron-log`. File at `userData/logs/app.log`, format `[YYYY-MM-DD HH:mm:ss] [level] text`.
- Use `logger.info` for normal state transitions, `logger.warn` for recoverable failures (fetch miss, unlink fail), `logger.error` for unexpected throws. Don't `console.log` in main-process code — it won't land in the log file.

## Conventions

- TypeScript strict; Vue `<script setup lang="ts">` throughout.
- Functional style for services (exported `const fn = ...`), not classes.
- Code comments explain **why**, not **what**. Korean in commit messages, English in code.
- No redundant docstrings/file banners. Keep comments one-liner unless a real invariant needs explaining.
- Don't introduce a linter, test framework, or prettier config without asking — the repo deliberately has none.
- When saving user files, always route through the image pipeline (`processThumbnail`/`processIcon`) so the `.webp` normalization + legacy cleanup invariant holds.

## When in doubt

- Touching the image pipeline? Trace a full save through `imageService` + `thumbnailService`/`iconService` + `dataService.updateProgram{Thumbnail,Icon}Path` + renderer cache-buster (`program.updatedAt` / `cacheBust` ref).
- Touching the edit dialog submit flow? Remember the watch-reset pitfall above.
- Adding an IPC? Update preload, main handler, and `ElectronAPI` type. Channel name: `namespace:action`.
- Adding UI strings? All four locales.
- Adding a setting? Extend `Settings` type, `DEFAULT_SETTINGS`, `isValidSettings`, store state, and the backfill in `loadSettings`.
