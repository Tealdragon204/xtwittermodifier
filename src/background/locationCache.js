'use strict';

// ── Location Cache ────────────────────────────────────────────────
// Cache entry: { country: string|null, queriedAt: ms, lastSeen: ms }
// Owned by background script — content scripts access via GET_LOCATION message.

let locationCache = {};

function loadCache() {
  return browser.storage.local.get('xopt_location_cache').then(data => {
    if (data.xopt_location_cache) {
      try {
        locationCache = JSON.parse(data.xopt_location_cache);
        // Migrate old-format entries (expiry-based) to new format (queriedAt-based)
        let dirty = false;
        for (const k of Object.keys(locationCache)) {
          const e = locationCache[k];
          if (e.expiry !== undefined && e.queriedAt === undefined) {
            e.queriedAt = e.expiry - CACHE_TTL;
            e.lastSeen  = e.queriedAt;
            delete e.expiry;
            delete e.source;
            dirty = true;
          }
        }
        if (dirty) persistCache();
        dbg('LocationCache: loaded', Object.keys(locationCache).length, 'entries');
      } catch { locationCache = {}; }
    }
  });
}

let cacheTimer = null;
function persistCache() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    browser.storage.local.set({ xopt_location_cache: JSON.stringify(locationCache) });
  }, 2000);
}

function cacheSet(screenName, country) {
  const now = Date.now();
  browser.storage.local.get('xopt_settings').then(data => {
    let maxSize = 512;
    try {
      const s = data.xopt_settings ? JSON.parse(data.xopt_settings) : {};
      maxSize = s.cacheMaxSize || 512;
    } catch {}

    if (locationCache[screenName]) {
      locationCache[screenName].country   = country;
      locationCache[screenName].queriedAt = now;
      locationCache[screenName].lastSeen  = now;
    } else {
      const keys = Object.keys(locationCache);
      if (keys.length >= maxSize) {
        let oldestKey = null, oldestTime = Infinity;
        for (const k of keys) {
          const ls = locationCache[k].lastSeen || 0;
          if (ls < oldestTime) { oldestTime = ls; oldestKey = k; }
        }
        if (oldestKey) { dbg('LRU evict: @' + oldestKey); delete locationCache[oldestKey]; }
      }
      locationCache[screenName] = { country, queriedAt: now, lastSeen: now };
    }
    persistCache();
  });
}

function cacheTouchSeen(screenName) {
  if (locationCache[screenName]) {
    locationCache[screenName].lastSeen = Date.now();
    persistCache();
  }
}

function cacheGet(screenName) {
  return locationCache[screenName] || null;
}

function cacheClear() {
  locationCache = {};
  browser.storage.local.set({ xopt_location_cache: '{}' });
}

function cacheGetAll() {
  return locationCache;
}
