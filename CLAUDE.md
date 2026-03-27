# CLAUDE.md — XOpt Firefox Extension

Unified Firefox MV2 extension for Twitter/X feed optimization and media tools.
Consolidates three userscripts (TRF, XVD, XTCD) with significant new features.
Full build specification was provided in the session that initiated this project.

## Session Rules

- Grep first. Read whole files only when grep is insufficient.
- For Phase N work, read only files listed in that phase's row below.
- Verify every Twitter `data-testid` selector against the live DOM before marking it done.
  Add a `// VERIFY SELECTOR` comment on any selector you cannot confirm live.
- When adding a new bundled dependency, list it in the Dependency Summary table in this file.

## Coding Standards

- **Global scope, not ES modules** — MV2 background scripts share one global scope (loaded
  in manifest order). Content scripts also share one global scope per tab. No `import`/`export`.
  All files are plain scripts. Variables declared at the top level are accessible to
  subsequently loaded scripts in the same context.
- **Concise over verbose**: prefer early returns, destructuring, and one-liners over
  multi-step temp vars. No padding.
- **No redundant comments**: comment only on *why* a decision was made or how a piece
  connects to its caller if that's non-obvious. Never restate what the code does.
- **No defensive boilerplate**: omit guards that cannot actually trigger.
- **No external runtime fetches**: all dependencies must be bundled in `src/assets/`.
  Nothing is fetched from a CDN at runtime.

## Architecture

```
manifest.json (MV2, persistent background)
      │
      ├── background scripts (shared global scope, loaded in order):
      │     shared/constants.js       — all constants, MSG enum, DEFAULT_SETTINGS, COUNTRY_DATA
      │     shared/utils.js           — pure helpers (extractTweetText, extractImages, etc.)
      │     background/tokenStore.js  — webRequest bearer+CSRF capture → getTokens()
      │     background/locationCache.js — TTL+LRU cache → cacheGet/cacheSet/cacheGetAll
      │     background/apiClient.js   — all Twitter API calls + rate-limited queue + getLocation()
      │     background/actionQueue.js — persistent auto-mute/block queue → enqueueAction()
      │     background/index.js       — onMessage dispatcher, subsystem init
      │
      └── content scripts (shared global scope per tab, loaded in order):
            shared/constants.js        — same file, re-loaded in content context
            shared/utils.js            — same file, re-loaded in content context
            content/observer.js        — single MutationObserver → registerObserverCallback()
            content/ui/toasts.js       — two-channel toast system (filter + action events)
            content/ui/panel.js        — floating settings panel, cache viewer, action log
            content/ui/quickMenu.js    — bottom toggle button with queue/action counters
            content/regionFilter.js    — badges, feed filtering, per-badge click menu, profile btn
            content/index.js           — entry point: loads settings, inits modules, SPA nav watch

All cross-origin API calls: content → browser.runtime.sendMessage → background → fetch()
All storage: browser.storage.local (key prefix: xopt_)
Settings changes in options page: broadcast to open x.com tabs via browser.tabs.sendMessage
```

## Phase Map

| Phase | Goal | Status | Key Files |
|-------|------|--------|-----------|
| 1 | Extension scaffold, token capture, message passing, storage migration | **Complete** | `manifest.json`, `background/index.js`, `background/tokenStore.js`, `shared/constants.js`, `shared/utils.js` |
| 2 | Region filter port (TRF → extension module, feature parity) | **Complete** | `background/apiClient.js`, `background/locationCache.js`, `background/actionQueue.js`, `content/regionFilter.js`, `content/observer.js`, `content/ui/` |
| 3 | Feed optimizer (DOM hiding, engagement suppression, scroll friction) | Planned | `content/feedOptimizer.js` |
| 4 | Content filtering (keyword blocking, nsfwjs NSFW detection) | Planned | `content/contentFilter.js`, `src/assets/models/` |
| 5 | Video downloader port (XVD → extension module, GIF-as-GIF via ffmpeg.wasm) | Planned | `content/videoDownloader.js`, `background/ffmpegWorker.js`, `src/assets/ffmpeg/` |
| 6 | Card downloader port (XTCD → extension module, depth control UI) | Planned | `content/cardDownloader.js` |
| 7 | Card + video compositing (canvas → ffmpeg → MP4, thread sequencing) | Planned | `content/cardDownloader.js`, `background/ffmpegWorker.js` |
| 8 | Options page (full settings UI, live propagation, import/export) | Planned | `src/options/index.html`, `src/options/index.js` |
| 9 | Polish and hardening (performance audit, edge cases, debug cleanup) | Planned | all |

## Message Types

Defined in `shared/constants.js` as `MSG`. Content scripts never call Twitter APIs directly.

| MSG key | Direction | Purpose |
|---|---|---|
| `GET_LOCATION` | content → bg | Resolve screen name to country (cache-first) |
| `FETCH_TWEET` | content → bg | Full tweet data for card rendering |
| `FETCH_VIDEO_URL` | content → bg | Extract best MP4 URL from tweet |
| `AUTO_ACTION` | content → bg | Enqueue mute/block for a screen name |
| `COMPOSITE_MEDIA` | content → bg | Card PNG + video blob → MP4 via ffmpeg |
| `CONVERT_GIF` | content → bg | MP4 blob → animated GIF via ffmpeg |
| `SETTINGS_UPDATED` | options/bg → content | Settings changed, reload and reapply |
| `ACTION_COMPLETED` | bg → content | Auto-action finished, update toast + panel |
| `RUN_MIGRATION` | bg → content | Trigger localStorage migration check |
| `GET_CACHE` | content → bg | Fetch full location cache for viewer |
| `CLEAR_CACHE` | content → bg | Wipe location cache |
| `GET_ACTION_STATE` | content → bg | Fetch actionQueue + actionLog for panel |
| `GET_QUEUE_STATUS` | content → bg | Fetch queue length + rate limit state for toggle btn |
| `MIGRATION_DATA` | content → bg | Send old userscript localStorage data for import |

## Storage Keys

All keys prefixed `xopt_`. Managed via `browser.storage.local`.

| Key | Content |
|---|---|
| `xopt_settings` | Full settings object (see `DEFAULT_SETTINGS` in `shared/constants.js`) |
| `xopt_location_cache` | `{ [screenName]: { country, queriedAt, lastSeen } }` |
| `xopt_action_queue` | `[{ username, action, country }]` |
| `xopt_action_log` | `{ [username]: { action, status, timestamp, httpStatus, country } }` |
| `xopt_bearer` | Persisted bearer token (fallback across page reloads) |
| `xopt_csrf` | Persisted CSRF token |

Migration: on first install, content script checks `localStorage` for `trf_settings`,
`trf_cache`, `trf_action_queue`, `trf_action_log` (old userscript keys) and sends them
to background via `MIGRATION_DATA` message for import into `browser.storage.local`.

## Known Constraints

- **Twitter DOM selectors** — `data-testid` attributes are stable but do rotate on
  Twitter deploys. The `ABOUT_QUERY_ID` and `TWEET_RESULT_QUERY_ID` GraphQL hashes also
  rotate. If API calls return 400, check query IDs first. Both are logged to background
  console at startup.

- **MV2 only** — Do not use MV3 APIs (`browser.action`, service workers, `declarativeNetRequest`).
  The persistent background page is intentional and required for the request queue,
  token store, and ffmpeg.wasm lifecycle.

- **ffmpeg.wasm — single-threaded build only** — Use the single-threaded distribution
  (`ffmpeg-core.js` without SharedArrayBuffer). Pinned to 0.12.x. Do not upgrade
  major versions without testing — API shape changes between majors.

- **nsfwjs — lazy load** — Do not load TensorFlow.js or the nsfwjs model unless
  `settings.nsfwDetection === true`. The model is ~25MB and should not consume memory
  for users who don't use the feature.

- **Single MutationObserver** — `content/observer.js` owns the one and only observer on
  `document.body`. All modules register callbacks via `registerObserverCallback()`.
  Never create a second observer.

- **No cross-origin fetch in content scripts** — All API calls go through background via
  `browser.runtime.sendMessage`. Content scripts have no direct network access.

- **Scroll friction and Twitter's virtual scroll** — Twitter reuses DOM nodes via React
  virtualisation. The scroll friction implementation must watch for node *insertion* at
  the bottom of the feed timeline, not node *update*. Test on both the home feed and a
  profile page — behaviour differs.

- **_settings vs _rfSettings** — `_settings` is the shared settings object declared in
  `content/index.js` and is the canonical reference for all content modules. `_rfSettings`
  in `regionFilter.js` is kept in sync via `rfInit(settings)` / `rfUpdateSettings(settings)`.
  `toasts.js` and `quickMenu.js` read from `_settings`, not `_rfSettings`.

## Dependency Summary

| Dependency | Version (pinned) | Location | Purpose |
|---|---|---|---|
| ffmpeg.wasm | 0.12.x | `src/assets/ffmpeg/` | GIF conversion, video compositing (Phase 5+) |
| nsfwjs | 2.4.x | `src/assets/nsfwjs.js` | NSFW image classification (Phase 4+) |
| @tensorflow/tfjs | (nsfwjs peer dep) | `src/assets/tfjs/` | nsfwjs runtime (Phase 4+) |

## File Responsibilities

| File | Responsibility |
|------|----------------|
| `manifest.json` | MV2 manifest, permissions, script load order |
| `shared/constants.js` | `FALLBACK_BEARER`, query IDs, `COUNTRY_DATA`, `DEFAULT_SETTINGS`, `MSG` enum, timing constants, `DEBUG` flag |
| `shared/utils.js` | Pure helpers: `dbg()`, `decodeEntities()`, `extractTweetText()`, `extractImages()`, `extractMediaInfo()`, `extractTweetResult()` |
| `background/tokenStore.js` | Captures bearer+CSRF via `webRequest`; persists to storage; provides `getTokens()` |
| `background/locationCache.js` | TTL+LRU cache for screenName→country; `cacheGet/cacheSet/cacheTouchSeen/cacheClear/cacheGetAll` |
| `background/apiClient.js` | `fetchAboutAccount`, `fetchTweetData`, `fetchVideoUrl`, rate-limited queue, `getLocation()`, `performAction()`, `getQueueStatus()` |
| `background/actionQueue.js` | Persistent auto-mute/block queue; `enqueueAction()`, `drainActionQueue()`, `getActionState()` |
| `background/index.js` | Message dispatcher; init for locationCache + actionQueue; migration trigger on install |
| `background/ffmpegWorker.js` | *(Phase 5)* Lazy ffmpeg.wasm wrapper; `convertToGif()`, `compositeVideoWithCard()` |
| `content/index.js` | Entry point: `loadSettings()`, `saveSettings()`, `boot()`, SPA nav watch, migration runner, `SETTINGS_UPDATED` listener |
| `content/observer.js` | `registerObserverCallback()`, `startObserver()` — one observer, debounced 250ms |
| `content/regionFilter.js` | `rfInit()`, `rfUpdateSettings()`, badge injection, `processNameEl()`, `applyFilter()`, `reapplyAll()`, `rfScanAll()`, `rfRescanAll()`, `showQuickMenu()`, `injectProfileWhitelistButton()` |
| `content/ui/toasts.js` | `showFilterToast()`, `showActionToast()` — reads from `_settings` |
| `content/ui/panel.js` | `togglePanel()`, `refreshPanelIfOpen()`, `buildPanel()`, `renderBlockLists()`, `showCacheViewer()`, `showActionLog()` |
| `content/ui/quickMenu.js` | `createToggleButton()` — bottom toggle tab with queue+action counters |
| `content/feedOptimizer.js` | *(Phase 3)* `buildStylesheet(settings)`, CSS injection, scroll friction, title badge patch |
| `content/contentFilter.js` | *(Phase 4)* Keyword matching on tweet text; nsfwjs lazy load + image classification |
| `content/videoDownloader.js` | *(Phase 5)* Video player controls button; download or GIF conversion trigger |
| `content/cardDownloader.js` | *(Phase 6+)* Tweet action row button; canvas compositor (`compositeThread`); depth control popover |
| `src/options/index.html` | *(Phase 8)* Full settings page |
| `src/options/index.js` | *(Phase 8)* Options page logic; saves settings; broadcasts `SETTINGS_UPDATED` |
