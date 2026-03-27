'use strict';

// ── Action Queue ──────────────────────────────────────────────────
// Persisted queue of auto-mute / auto-block operations.
// Drains slowly (ACTION_INTERVAL between calls) to avoid rate limiting.

let actionQueue  = [];
let actionLog    = {};
let actionActive = false;
let lastActionTime = 0;

function loadActionData() {
  return Promise.all([
    browser.storage.local.get('xopt_action_queue'),
    browser.storage.local.get('xopt_action_log'),
  ]).then(([qData, lData]) => {
    try { if (qData.xopt_action_queue) actionQueue = JSON.parse(qData.xopt_action_queue); } catch { actionQueue = []; }
    try { if (lData.xopt_action_log)   actionLog   = JSON.parse(lData.xopt_action_log);   } catch { actionLog = {};   }
    dbg('ActionQueue: loaded', actionQueue.length, 'queued,', Object.keys(actionLog).length, 'logged');
  });
}

let aqTimer = null;
function persistActionQueue() {
  clearTimeout(aqTimer);
  aqTimer = setTimeout(() => browser.storage.local.set({ xopt_action_queue: JSON.stringify(actionQueue) }), 500);
}

let alTimer = null;
function persistActionLog() {
  clearTimeout(alTimer);
  alTimer = setTimeout(() => browser.storage.local.set({ xopt_action_log: JSON.stringify(actionLog) }), 500);
}

function enqueueAction(username, action, country) {
  const u = username.toLowerCase();
  if (actionLog[u]) return;
  if (actionQueue.find(e => e.username === u)) return;
  dbg(`Enqueueing ${action} for @${u} (${country})`);
  actionQueue.push({ username: u, action, country: country || null });
  persistActionQueue();
  scheduleActionDrain();
}

function scheduleActionDrain() {
  if (actionActive || !actionQueue.length) return;
  const wait = Math.max(0, ACTION_INTERVAL - (Date.now() - lastActionTime));
  setTimeout(drainActionQueue, wait);
}

async function drainActionQueue() {
  if (actionActive || !actionQueue.length) return;

  const settingsData = await browser.storage.local.get('xopt_settings');
  let autoAction = 'off';
  try {
    const s = settingsData.xopt_settings ? JSON.parse(settingsData.xopt_settings) : {};
    autoAction = s.autoAction || 'off';
  } catch {}

  if (autoAction === 'off') return;

  const { csrf } = getTokens();
  if (!csrf) { setTimeout(drainActionQueue, 3000); return; }

  actionActive = true;
  const { username, action, country } = actionQueue[0];
  dbg(`Auto-${action}: @${username}`);

  try {
    const result = await performAction(username, action, csrf);

    if (result.status === 429) {
      dbg('Action rate limited — backing off 5 min');
      actionActive = false;
      setTimeout(drainActionQueue, 5 * 60 * 1000);
      return;
    }

    actionLog[username] = {
      action,
      status:    result.ok ? 'done' : 'failed',
      timestamp: Date.now(),
      httpStatus: result.status,
      country:   country || cacheGet(username)?.country || null,
    };
    persistActionLog();

    if (result.ok) {
      // Notify any open x.com tabs about the completed action
      browser.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] }).then(tabs => {
        tabs.forEach(tab => browser.tabs.sendMessage(tab.id, {
          type: 'ACTION_COMPLETED',
          country: actionLog[username].country,
          action,
        }).catch(() => {}));
      });
    }
  } catch (e) {
    dbg(`Auto-${action} @${username}: error`, e);
    actionLog[username] = { action, status: 'error', timestamp: Date.now() };
    persistActionLog();
  }

  actionQueue.shift();
  persistActionQueue();
  lastActionTime = Date.now();
  actionActive = false;
  scheduleActionDrain();
}

function getActionState() {
  return { actionQueue, actionLog, actionActive };
}
