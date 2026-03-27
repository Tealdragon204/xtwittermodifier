'use strict';

// ── Token Store ───────────────────────────────────────────────────
// Captures bearer + CSRF tokens from outgoing Twitter API requests
// via webRequest, storing them for use by all background API calls.
// This replaces the userscript approach of patching unsafeWindow XHR/fetch.

let bearer = FALLBACK_BEARER;
let csrf   = null;

// Restore persisted tokens on startup (covers page reloads before any API request fires)
browser.storage.local.get(['xopt_bearer', 'xopt_csrf']).then(data => {
  if (data.xopt_bearer) bearer = data.xopt_bearer;
  if (data.xopt_csrf)   csrf   = data.xopt_csrf;
  dbg('TokenStore: loaded persisted tokens, bearer=' + (bearer ? bearer.slice(0, 20) + '…' : 'none'));
});

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    let changed = false;
    for (const header of details.requestHeaders) {
      const name = header.name.toLowerCase();
      if (name === 'authorization' && header.value.startsWith('Bearer ')) {
        const newBearer = header.value.slice(7);
        if (newBearer !== bearer) { bearer = newBearer; changed = true; }
      }
      if (name === 'x-csrf-token' && header.value) {
        if (header.value !== csrf) { csrf = header.value; changed = true; }
      }
    }
    if (changed) {
      dbg('TokenStore: captured fresh tokens');
      browser.storage.local.set({ xopt_bearer: bearer, xopt_csrf: csrf });
    }
  },
  { urls: ['https://x.com/i/api/*', 'https://twitter.com/i/api/*'] },
  ['requestHeaders']
);

function getTokens() {
  return { bearer, csrf };
}
