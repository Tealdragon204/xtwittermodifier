'use strict';

// ── Background page entry point ───────────────────────────────────
// Load order matters: constants and utils must be first so all
// subsequent scripts can reference them. Scripts are concatenated
// by the browser from the manifest scripts array — we use a single
// entry point and load order via importScripts-style inline loading.
// Since MV2 background scripts share a single global scope and are
// loaded in array order (manifest), this file is the last loaded and
// can reference everything defined in earlier scripts.

// Log active query IDs at startup to help diagnose rotation issues
dbg('XOpt background started');
dbg(`ABOUT_QUERY_ID: ${ABOUT_QUERY_ID}`);
dbg(`TWEET_RESULT_QUERY_ID: ${TWEET_RESULT_QUERY_ID}`);

// ── Storage migration (userscript → extension) ────────────────────
// Runs once on install/update. Imports any localStorage keys left by
// the old userscripts into browser.storage.local.
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    dbg('Running storage migration check');
    // We cannot access page localStorage from background, but content
    // scripts can. Send a migration request to any open x.com tabs.
    const tabs = await browser.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
    tabs.forEach(tab => browser.tabs.sendMessage(tab.id, { type: 'RUN_MIGRATION' }).catch(() => {}));
  }
});

// ── Initialise subsystems ─────────────────────────────────────────
Promise.all([loadCache(), loadActionData()]).then(() => {
  dbg('Background subsystems ready');
  // Resume any queued actions surviving a browser restart
  scheduleActionDrain();
});

// ── Message dispatcher ────────────────────────────────────────────
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = async () => {
    switch (msg.type) {

      case MSG.GET_LOCATION: {
        const result = await getLocation(msg.screenName);
        return result;
      }

      case MSG.FETCH_TWEET: {
        const data = await fetchTweetData(msg.tweetId);
        return data;
      }

      case MSG.FETCH_VIDEO_URL: {
        const result = await fetchVideoUrl(msg.tweetId);
        return result;
      }

      case MSG.AUTO_ACTION: {
        const country = cacheGet(msg.username)?.country || null;
        enqueueAction(msg.username, msg.action, country);
        return { ok: true };
      }

      case 'GET_CACHE': {
        return { cache: cacheGetAll() };
      }

      case 'CLEAR_CACHE': {
        cacheClear();
        return { ok: true };
      }

      case 'GET_ACTION_STATE': {
        return getActionState();
      }

      case 'MIGRATION_DATA': {
        // Content script sends old localStorage data for import
        if (msg.settings)    browser.storage.local.set({ xopt_settings: msg.settings });
        if (msg.cache)       browser.storage.local.set({ xopt_location_cache: msg.cache });
        if (msg.actionQueue) browser.storage.local.set({ xopt_action_queue: msg.actionQueue });
        if (msg.actionLog)   browser.storage.local.set({ xopt_action_log: msg.actionLog });
        dbg('Migration data received and stored');
        return { ok: true };
      }

      case 'GET_QUEUE_STATUS': {
        return getQueueStatus();
      }

      default:
        dbg('Unknown message type:', msg.type);
        return null;
    }
  };

  handle().then(sendResponse).catch(e => {
    dbg('Message handler error:', e);
    sendResponse({ error: String(e) });
  });

  return true; // keep channel open for async response
});
