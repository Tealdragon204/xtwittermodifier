'use strict';

// ── Content script entry point ────────────────────────────────────
// Loads settings, initialises all feature modules, starts the
// single shared MutationObserver.

let _settings = { ...DEFAULT_SETTINGS };

// ── Storage helpers ───────────────────────────────────────────────

function loadSettings() {
  return browser.storage.local.get('xopt_settings').then(data => {
    try {
      if (data.xopt_settings) _settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data.xopt_settings) };
    } catch { _settings = { ...DEFAULT_SETTINGS }; }
    return _settings;
  });
}

function saveSettings(newSettings) {
  _settings = { ..._settings, ...newSettings };
  browser.storage.local.set({ xopt_settings: JSON.stringify(_settings) });
}

// ── Storage migration from userscripts ───────────────────────────

function runMigration() {
  try {
    const keys = {
      trf_settings:     'xopt_settings',
      trf_cache:        'xopt_location_cache',
      trf_action_queue: 'xopt_action_queue',
      trf_action_log:   'xopt_action_log',
    };
    const payload = {};
    let found = false;
    for (const [oldKey, newKey] of Object.entries(keys)) {
      const val = localStorage.getItem(oldKey);
      if (val) {
        payload[newKey.replace('xopt_', '')] = val; // send raw JSON
        localStorage.removeItem(oldKey);
        found = true;
      }
    }
    if (found) {
      browser.runtime.sendMessage({ type: 'MIGRATION_DATA', ...payload });
      dbg('Migration: found and sent old userscript data');
    }
  } catch (e) {
    dbg('Migration error:', e);
  }
}

// ── Settings change listener ──────────────────────────────────────

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SETTINGS_UPDATED') {
    loadSettings().then(s => {
      _settings = s;
      rfUpdateSettings(s);
      reapplyAll();
    });
  }
  if (msg.type === 'ACTION_COMPLETED') {
    showActionToast(msg.country, msg.action);
    refreshPanelIfOpen();
  }
  if (msg.type === 'RUN_MIGRATION') {
    runMigration();
  }
});

// ── Boot ──────────────────────────────────────────────────────────

function boot() {
  loadSettings().then(settings => {
    _settings = settings;

    // Share settings ref with region filter module (same global scope)
    // _rfSettings is declared in regionFilter.js and used by panel/toasts
    // We re-assign it here from loaded storage.
    // (All content scripts share one global scope in MV2.)

    rfInit(settings);
    createToggleButton();
    startObserver();
    rfScanAll();
    injectProfileWhitelistButton();
  });

  // SPA navigation watch
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      document.getElementById('xopt-profile-btn')?.remove();
      setTimeout(injectProfileWhitelistButton, 800);
    }
  }, 500);
}

if (document.body) boot();
else document.addEventListener('DOMContentLoaded', boot);
