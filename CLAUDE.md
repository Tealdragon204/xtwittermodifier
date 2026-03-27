# CLAUDE.md — XOpt Firefox Extension

Unified Firefox MV2 extension for Twitter/X feed optimization and media tools.
Consolidates three userscripts (TRF, XVD, XTCD) with significant new features.
Full build specification in `XOPT_EXTENSION_PLAN.md`.

## Session Rules

- Grep first. Read whole files only when grep is insufficient.
- For Phase N work, read only files listed in that phase's row below.
- Skip `XOPT_EXTENSION_PLAN.md` for implementation tasks — it is the spec, not a file to edit.
- Verify every Twitter `data-testid` selector against the live DOM before marking it done.
  Add a `// VERIFY SELECTOR` comment on any selector you cannot confirm live.
- When adding a new bundled dependency, list it in the Dependency Summary table in this file.

## Coding Standards

- **Concise over verbose**: prefer early returns, destructuring, and one-liners over
  multi-step temp vars. No padding.
- **No redundant comments**: comment only on *why* a decision was made or how a piece
  connects to its caller if that's non-obvious. Never restate what the code does.
- **No defensive boilerplate**: omit guards that cannot actually trigger.
- **ES modules throughout**: all `src/` files use `import`/`export`. No CommonJS.
- **No external runtime fetches**: all dependencies must be bundled in `src/assets/`.
  Nothing is fetched from a CDN at runtime.

## Architecture

```
manifest.json (MV2, persistent background)
      │
      ├── background/index.js ──► tokenStore.js  (webRequest header capture)
      │                      ──► apiClient.js    (all Twitter GraphQL/REST, request queue)
      │                      ──► locationCache.js (TTL + LRU, backed by browser.storage.local)
      │                      ──► actionQueue.js  (auto-mute/block queue)
      │                      ──► ffmpegWorker.js (lazy-loaded, GIF conversion + compositing)
      │
      └── content/index.js ──► observer.js       (single MutationObserver, callback registry)
                           ──► regionFilter.js   (country badges + feed filtering)
                           ──► feedOptimizer.js  (CSS injection, scroll friction)
                           ──► contentFilter.js  (keyword blocking + nsfwjs detection)
                           ──► videoDownloader.js (video/GIF download button)
                           ──► cardDownloader.js  (tweet card PNG/MP4 download button)
                           ──► ui/panel.js        (floating quick-access panel)
                           ──► ui/quickMenu.js    (per-badge click menu)
                           ──► ui/toasts.js       (toast notifications)

All cross-origin API calls: content → browser.runtime.sendMessage → background → fetch()
All storage: browser.storage.local (key prefix: xopt_)
Settings changes in options page: broadcast to open x.com tabs via browser.tabs.sendMessage
```

## Phase Map

| Phase | Goal | Status | Key Files |
|-------|------|--------|-----------|
| 1 | Extension scaffold, token capture, message passing, storage migration | Planned | `manifest.json`, `background/index.js`, `background/tokenStore.js`, `shared/constants.js` |
| 2 | Region filter port (TRF → extension module, feature parity) | Planned | `background/apiClient.js`, `background/locationCache.js`, `background/actionQueue.js`, `content/regionFilter.js`, `content/observer.js`, `content/ui/` |
| 3 | Feed optimizer (DOM hiding, engagement suppression, scroll friction) | Planned | `content/feedOptimizer.js`, `shared/constants.js` |
| 4 | Content filtering (keyword blocking, nsfwjs NSFW detection) | Planned | `content/contentFilter.js`, `src/assets/models/` |
| 5 | Video downloader port (XVD → extension module, GIF-as-GIF via ffmpeg.wasm) | Planned | `content/videoDownloader.js`, `background/ffmpegWorker.js`, `src/assets/ffmpeg/` |
| 6 | Card downloader port (XTCD → extension module, depth control UI) | Planned | `content/cardDownloader.js` |
| 7 | Card + video compositing (canvas → ffmpeg → MP4, thread sequencing) | Planned | `content/cardDownloader.js`, `background/ffmpegWorker.js` |
| 8 | Options page (full settings UI, live propagation, import/export) | Planned | `src/options/` |
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
| `SETTINGS_UPDATED` | options → content | Settings changed, reload and reapply |

## Storage Keys

All keys prefixed `xopt_`. Managed via `browser.storage.local`.

| Key | Content |
|---|---|
| `xopt_settings` | Full settings object (see DEFAULT_SETTINGS in constants.js) |
| `xopt_location_cache` | `{ [screenName]: { country, queriedAt, lastSeen } }` |
| `xopt_action_queue` | `[{ username, action, country }]` |
| `xopt_action_log` | `{ [username]: { action, status, timestamp, httpStatus, country } }` |

Migration: on first install, check localStorage for `trf_settings`, `trf_cache`,
`trf_action_queue`, `trf_action_log` (userscript remnants) and import them.

## Known Constraints

- **Twitter DOM selectors** — `data-testid` attributes are stable but do rotate on
  Twitter deploys. The `ABOUT_QUERY_ID` and `TWEET_RESULT_QUERY_ID` GraphQL hashes also
  rotate. If API calls return 400, check query IDs first. Log the IDs in use at startup.

- **MV2 only** — Do not use MV3 APIs (`browser.action`, service workers, declarativeNetRequest).
  The persistent background page is intentional and required for the request queue,
  token store, and ffmpeg.wasm lifecycle.

- **ffmpeg.wasm — single-threaded build only** — Use the single-threaded distribution
  (`ffmpeg-core.js` without SharedArrayBuffer). Pinned to 0.12.x. Do not upgrade
  major versions without testing — API shape changes between majors.

- **nsfwjs — lazy load** — Do not load TensorFlow.js or the nsfwjs model unless
  `settings.nsfwDetection === true`. The model is ~25MB and should not consume memory
  for users who don't use the feature.

- **Single MutationObserver** — `content/observer.js` owns the one and only observer on
  `document.body`. All modules register callbacks with it. Never create a second observer.

- **No cross-origin fetch in content scripts** — All API calls go through background via
  `browser.runtime.sendMessage`. Content scripts have no `@connect` grants.

- **Scroll friction and Twitter's virtual scroll** — Twitter reuses DOM nodes via React
  virtualisation. The scroll friction implementation must watch for node *insertion* at
  the bottom of the feed timeline, not node *update*. Test on both the home feed and a
  profile page — behaviour differs.

## Dependency Summary

| Dependency | Version (pinned) | Location | Purpose |
|---|---|---|---|
| ffmpeg.wasm | 0.12.x | `src/assets/ffmpeg/` | GIF conversion, video compositing |
| nsfwjs | 2.4.x | `src/assets/nsfwjs.js` | NSFW image classification |
| @tensorflow/tfjs | (nsfwjs peer dep) | `src/assets/tfjs/` | nsfwjs runtime |

## File Responsibilities

| File | Responsibility |
|------|----------------|
| `manifest.json` | MV2 manifest, permissions, content script registration |
| `background/index.js` | Background page entry; registers message listener, dispatches to handlers |
| `background/tokenStore.js` | Captures bearer + CSRF via webRequest; provides `getTokens()` |
| `background/apiClient.js` | All Twitter API calls + rate-limited request queue |
| `background/locationCache.js` | TTL + LRU cache for screen name → country; backed by storage |
| `background/actionQueue.js` | Persistent auto-mute/block queue with 8s inter-action delay |
| `background/ffmpegWorker.js` | Lazy ffmpeg.wasm wrapper; GIF conversion and video compositing |
| `content/index.js` | Content script entry; loads settings, inits modules, starts observer |
| `content/observer.js` | Single MutationObserver coordinator; debounced callback registry |
| `content/regionFilter.js` | Country badge injection + country/region-based feed filtering |
| `content/feedOptimizer.js` | CSS injection for DOM hiding; scroll friction; title badge suppression |
| `content/contentFilter.js` | Keyword matching on tweet text; nsfwjs image classification |
| `content/videoDownloader.js` | Video player controls button; triggers download or GIF conversion |
| `content/cardDownloader.js` | Tweet action row button; canvas compositor; depth control popover |
| `content/ui/panel.js` | Floating quick-access panel (settings summary + block lists) |
| `content/ui/quickMenu.js` | Per-badge click menu (block/unblock country/region, whitelist) |
| `content/ui/toasts.js` | Two-channel toast system (filter events, action events) |
| `shared/constants.js` | FALLBACK_BEARER, query IDs, COUNTRY_DATA, DEFAULT_SETTINGS, MSG enum |
| `shared/utils.js` | Pure utility functions shared across content and background |
| `src/options/index.html` | Full settings options page |
| `src/options/index.js` | Options page logic; saves settings; broadcasts SETTINGS_UPDATED |
