'use strict';

// ── Region Filter ─────────────────────────────────────────────────
// Port of TRF DOM logic. Badge injection, feed filtering, quick menu.
// All API calls go through background via browser.runtime.sendMessage.

let _rfSettings = { ...DEFAULT_SETTINGS };

function rfInit(settings) {
  _rfSettings = settings;
  registerObserverCallback(() => {
    rfScanAll();
    injectProfileWhitelistButton();
  });
}

function rfUpdateSettings(settings) {
  _rfSettings = settings;
}

// ── Filter and label logic ────────────────────────────────────────

function isBlocked(country, region, username) {
  if (username && _rfSettings.whitelistedAccounts.includes(username.toLowerCase())) return false;
  if (!country) return false;
  if (_rfSettings.blockedCountries.includes(country)) return true;
  if (region && _rfSettings.blockedRegions.includes(region)) return true;
  return false;
}

function isWhitelisted(username) {
  return !!username && _rfSettings.whitelistedAccounts.includes(username.toLowerCase());
}

function rfToggleWhitelist(username) {
  const u = username.toLowerCase();
  if (_rfSettings.whitelistedAccounts.includes(u)) {
    _rfSettings.whitelistedAccounts = _rfSettings.whitelistedAccounts.filter(x => x !== u);
  } else {
    _rfSettings.whitelistedAccounts.push(u);
  }
  saveSettings(_rfSettings);
  reapplyAll();
  refreshPanelIfOpen();
}

function buildBadgeText(country, blocked) {
  if (!country) return null;
  const d = COUNTRY_DATA[country];
  const flag = d?.flag || null;
  const region = d?.region || null;

  if (blocked) {
    return region ? '\u25CB Hidden \xB7 ' + region : '\u25CB Hidden';
  }

  switch (_rfSettings.displayMode) {
    case 'country': return flag ? flag + ' ' + country : '\u25CB ' + country;
    case 'region':  return flag ? flag + ' ' + (region || country) : '\u25CB ' + (region || country);
    default:
      if (flag && region)  return flag + ' ' + country + ' \xB7 ' + region;
      if (flag)            return flag + ' ' + country;
      if (region)          return '\u25CB ' + country + ' \xB7 ' + region;
      return '\u25CB ' + country;
  }
}

// ── DOM helpers ───────────────────────────────────────────────────

function findHandleLink(nameEl) {
  if (!nameEl) return null;
  const candidates = [...nameEl.querySelectorAll('a[href]')].filter(a =>
    /^\/[A-Za-z0-9_]{1,15}$/.test(a.getAttribute('href')) ||
    /^https?:\/\/(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}$/.test(a.getAttribute('href'))
  );
  return candidates.find(a => a.textContent.trim().startsWith('@')) || candidates[candidates.length - 1] || null;
}

function findHandleEl(nameEl) {
  const link = findHandleLink(nameEl);
  if (link) return link;
  for (const span of nameEl.querySelectorAll('span')) {
    if (/^@[A-Za-z0-9_]{1,15}$/.test(span.textContent.trim())) return span;
  }
  return null;
}

function isFeedLayout(nameEl) {
  const row = nameEl.parentElement;
  if (!row) return false;
  if (row.querySelector('time')) return true;
  if (row.parentElement?.querySelector('time')) return true;
  return false;
}

function getExistingBadge(nameEl) {
  const ref = nameEl.dataset.xoptBadgeRef;
  if (ref) return document.getElementById(ref);
  return nameEl.querySelector('[data-xopt-badge]');
}

const BADGE_STYLE_BASE = [
  'border-radius:3px',
  'font-size:11px',
  'font-weight:400',
  'line-height:1.5',
  'background:transparent',
  'border:1px solid #2f3336',
  'color:#536471',
  'cursor:pointer',
  'white-space:nowrap',
  'user-select:none',
  'letter-spacing:0.01em',
  'transition:border-color 0.1s,color 0.1s',
].join(';');

let _badgeIdSeq = 0;

function getOrCreateBadge(nameEl) {
  const existing = getExistingBadge(nameEl);
  if (existing) return existing;

  const feedLayout = isFeedLayout(nameEl);
  const badge = document.createElement('span');
  const id = 'xopt-badge-' + (++_badgeIdSeq);
  badge.id = id;
  badge.setAttribute('data-xopt-badge', 'true');
  nameEl.dataset.xoptBadgeRef = id;

  if (feedLayout) {
    badge.style.cssText = BADGE_STYLE_BASE + ';display:block;padding:1px 6px;margin-top:2px;flex-basis:100%;width:fit-content;';
    const row = nameEl.parentElement;
    if (row) {
      row.style.flexWrap = 'wrap';
      nameEl.after(badge);
    } else {
      nameEl.appendChild(badge);
    }
  } else {
    badge.style.cssText = BADGE_STYLE_BASE + ';display:inline-flex;align-items:center;padding:1px 6px;margin-left:6px;flex-shrink:0;vertical-align:middle;';
    const handleEl = findHandleEl(nameEl);
    if (handleEl) {
      let node = handleEl.tagName === 'SPAN' ? handleEl.parentElement : handleEl;
      while (node.parentElement && node.parentElement !== nameEl) {
        if (node.parentElement.className.includes('r-18u37iz')) {
          node.after(badge);
          break;
        }
        node = node.parentElement;
      }
      if (!badge.parentElement) nameEl.appendChild(badge);
    } else {
      nameEl.appendChild(badge);
    }
  }

  badge.onmouseenter = () => { badge.style.borderColor = '#536471'; badge.style.color = '#e7e9ea'; };
  badge.onmouseleave = () => { badge.style.borderColor = '#2f3336'; badge.style.color = '#536471'; };

  return badge;
}

function applyFilter(article, country, region, username) {
  const cell = article.closest('[data-testid="cellInnerDiv"]') || article;
  if (!_rfSettings.enabled || !isBlocked(country, region, username)) {
    cell.style.display = '';
    cell.style.opacity = '';
    cell.style.filter = '';
    return;
  }
  if (_rfSettings.filterAction === 'hide') {
    if (cell.style.display !== 'none') showFilterToast(country);
    cell.style.display = 'none';
  } else {
    if (cell.style.opacity !== '0.18') showFilterToast(country);
    cell.style.opacity = '0.18';
    cell.style.filter = 'grayscale(1)';
  }
}

function reapplyAll() {
  document.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
    const country  = article.dataset.xoptCountry  || null;
    const username = article.dataset.xoptUsername || null;
    const region   = country ? (COUNTRY_DATA[country]?.region || null) : null;
    applyFilter(article, country, region, username);
    article.querySelectorAll('[data-testid="User-Name"][data-xopt-done]').forEach(nameEl => {
      const badge = getExistingBadge(nameEl);
      if (!badge) return;
      const blocked = isBlocked(country, region, username);
      const label = buildBadgeText(country, blocked);
      if (label) {
        const dot = badge.querySelector('[data-xopt-src]');
        if (dot && badge.firstChild !== dot) badge.firstChild.textContent = label;
        else if (!dot) badge.textContent = label;
      }
      if (username && isWhitelisted(username)) {
        badge.style.borderColor = '#2a4a2a';
        badge.style.color = '#4a7a4a';
      } else {
        badge.style.borderColor = '#2f3336';
        badge.style.color = '#536471';
      }
    });
  });
}

// ── Tweet processing ──────────────────────────────────────────────

function setBadgeState(badge, state, text) {
  badge.dataset.xoptState = state;
  const dot = badge.querySelector('[data-xopt-src]');
  if (dot) {
    badge.firstChild.textContent = text;
  } else {
    badge.textContent = text;
  }
  badge.style.opacity = state === 'loading' || state === 'ratelimited' ? '0.45' : '1';
  badge.style.fontStyle = state === 'loading' || state === 'ratelimited' ? 'italic' : 'normal';
  badge.style.cursor = state === 'done' || state === 'blocked' ? 'pointer' : 'default';
  badge.onclick = null;
}

async function processNameEl(nameEl, article) {
  if (nameEl.dataset.xoptDone) return;

  const username = (() => {
    for (const a of nameEl.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (/^\/[A-Za-z0-9_]{1,15}$/.test(href)) return href.slice(1);
      const abs = href.match(/^https?:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})$/);
      if (abs) return abs[1];
    }
    for (const span of nameEl.querySelectorAll('span')) {
      const t = span.textContent.trim();
      if (/^@[A-Za-z0-9_]{1,15}$/.test(t)) return t.slice(1);
    }
    return null;
  })();

  if (!username) return;
  nameEl.dataset.xoptDone = '1';

  const badge = getOrCreateBadge(nameEl);
  setBadgeState(badge, 'loading', 'Loading');

  let country, source;
  try {
    const result = await browser.runtime.sendMessage({ type: MSG.GET_LOCATION, screenName: username });
    if (result?.rateLimited) {
      setBadgeState(badge, 'ratelimited', 'Rate Limited');
      setTimeout(() => {
        if (nameEl.isConnected) {
          delete nameEl.dataset.xoptDone;
          badge.remove();
          processNameEl(nameEl, article);
        }
      }, 65000);
      return;
    }
    if (result?.noToken) {
      setBadgeState(badge, 'notoken', '?');
      setTimeout(() => {
        if (nameEl.isConnected) {
          delete nameEl.dataset.xoptDone;
          badge.remove();
          processNameEl(nameEl, article);
        }
      }, 5000);
      return;
    }
    country = result?.country ?? null;
    source  = result?.source ?? 'api';
  } catch {
    country = null;
    source  = 'api';
  }

  if (!nameEl.isConnected) return;

  const region  = country ? (COUNTRY_DATA[country]?.region || null) : null;
  const blocked = isBlocked(country, region, username);
  const label   = buildBadgeText(country, blocked);

  if (label) {
    setBadgeState(badge, blocked ? 'blocked' : 'done', label);
    badge.title = 'Account based in: ' + (country || '?') + '\nRegion: ' + (region || '?') + '\nClick for options';
    badge.onclick = (e) => { e.stopPropagation(); showQuickMenu(badge, username, country, region, article); };

    const dot = document.createElement('span');
    dot.setAttribute('data-xopt-src', '');
    dot.style.cssText = 'margin-left:4px;font-size:9px;';
    if (source === 'cache') {
      dot.textContent = '◦';
      dot.style.opacity = '0.25';
      dot.title = 'Served from cache';
    } else if (source === 'stale') {
      dot.textContent = '◈';
      dot.style.opacity = '0.28';
      dot.title = 'Stale cache — background refresh queued';
    } else {
      dot.textContent = '●';
      dot.style.opacity = '0.45';
      dot.title = 'Fresh from API';
    }
    badge.appendChild(dot);
  } else {
    badge.remove();
    return;
  }

  if (isWhitelisted(username)) {
    badge.style.borderColor = '#2a4a2a';
    badge.style.color = '#4a7a4a';
  }

  if (article) {
    if (!nameEl.closest('[data-testid="quoteTweet"]') && !nameEl.closest('[data-scribe~="component:quote_tweet"]')) {
      article.dataset.xoptCountry  = country || '';
      article.dataset.xoptUsername = username || '';
      applyFilter(article, country, region, username);
      if (_rfSettings.autoAction !== 'off' && blocked) {
        browser.runtime.sendMessage({ type: MSG.AUTO_ACTION, username, action: _rfSettings.autoAction });
      }
    }
  }
}

// ── Quick menu ────────────────────────────────────────────────────

let _activeMenu = null;

function showQuickMenu(anchor, username, country, region, article) {
  if (_activeMenu) { _activeMenu.remove(); _activeMenu = null; }

  const menu = document.createElement('div');
  menu.style.cssText = `
    position:fixed;z-index:100000;background:#000;border:1px solid #2f3336;
    border-radius:8px;padding:4px 0;min-width:220px;
    box-shadow:0 4px 20px rgba(0,0,0,0.75);
    font-family:-apple-system,system-ui,sans-serif;font-size:13px;color:#e7e9ea;
  `;

  const rect = anchor.getBoundingClientRect();
  menu.style.top  = `${Math.min(rect.bottom + 4, window.innerHeight - 180)}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`;

  const items = [];

  if (username) {
    const wl = isWhitelisted(username);
    items.push({
      label: wl ? `- Remove @${username} from whitelist` : `+ Whitelist @${username}`,
      action() { rfToggleWhitelist(username); },
    });
    items.push({ separator: true });
  }

  if (country) {
    const cBlocked = _rfSettings.blockedCountries.includes(country);
    const d = COUNTRY_DATA[country];
    items.push({
      label: cBlocked ? `- Unblock ${d?.flag || ''} ${country}` : `+ Block ${d?.flag || ''} ${country}`,
      action() {
        if (cBlocked) _rfSettings.blockedCountries = _rfSettings.blockedCountries.filter(x => x !== country);
        else if (!_rfSettings.blockedCountries.includes(country)) _rfSettings.blockedCountries.push(country);
        saveSettings(_rfSettings); reapplyAll(); refreshPanelIfOpen();
      },
    });
  }

  if (region) {
    const rBlocked = _rfSettings.blockedRegions.includes(region);
    items.push({
      label: rBlocked ? `- Unblock region: ${region}` : `+ Block entire region: ${region}`,
      action() {
        if (rBlocked) _rfSettings.blockedRegions = _rfSettings.blockedRegions.filter(x => x !== region);
        else if (!_rfSettings.blockedRegions.includes(region)) _rfSettings.blockedRegions.push(region);
        saveSettings(_rfSettings); reapplyAll(); refreshPanelIfOpen();
      },
    });
  }

  items.push({ separator: true });

  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:#2f3336;margin:4px 0;';
      menu.appendChild(sep);
      continue;
    }
    const el = document.createElement('div');
    el.textContent = item.label;
    el.style.cssText = 'padding:9px 14px;cursor:pointer;color:#e7e9ea;';
    el.onmouseenter = () => el.style.background = '#16181c';
    el.onmouseleave = () => el.style.background = '';
    el.onclick = (e) => { e.stopPropagation(); item.action(); menu.remove(); _activeMenu = null; };
    menu.appendChild(el);
  }

  document.body.appendChild(menu);
  _activeMenu = menu;

  const dismiss = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove(); _activeMenu = null;
      document.removeEventListener('click', dismiss, true);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss, true), 50);
}

// ── Scanning ──────────────────────────────────────────────────────

function getArticleForNameEl(nameEl) {
  return nameEl.closest('article[data-testid="tweet"]') || null;
}

function isPrimaryNameEl(nameEl) {
  return !nameEl.closest('[data-testid="quoteTweet"]');
}

function rfScanAll() {
  if (!_rfSettings.enabled) return;
  document.querySelectorAll('[data-testid="User-Name"]:not([data-xopt-done])').forEach(nameEl => {
    const article = isPrimaryNameEl(nameEl) ? getArticleForNameEl(nameEl) : null;
    processNameEl(nameEl, article);
  });
}

function rfRescanAll() {
  document.querySelectorAll('[data-testid="User-Name"][data-xopt-done]').forEach(el => {
    const badge = getExistingBadge(el);
    if (badge) badge.remove();
    delete el.dataset.xoptDone;
    delete el.dataset.xoptBadgeRef;
    if (el.parentElement) el.parentElement.style.flexWrap = '';
  });
  document.querySelectorAll('article[data-testid="tweet"]').forEach(a => {
    delete a.dataset.xoptCountry;
    a.style.display = '';
    a.style.opacity = '';
    a.style.filter  = '';
    const cell = a.closest('[data-testid="cellInnerDiv"]');
    if (cell) { cell.style.display = ''; cell.style.opacity = ''; cell.style.filter = ''; }
  });
  rfScanAll();
}

// ── Profile whitelist button ──────────────────────────────────────

function injectProfileWhitelistButton() {
  const match = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})$/);
  if (!match) { document.getElementById('xopt-profile-btn')?.remove(); return; }
  const username = match[1].toLowerCase();
  if (['home','explore','notifications','messages','search','settings','i'].includes(username)) {
    document.getElementById('xopt-profile-btn')?.remove(); return;
  }
  if (document.getElementById('xopt-profile-btn')) return;

  const handleSpan = [...document.querySelectorAll('span')].find(
    s => s.textContent.trim() === '@' + match[1]
  );
  if (!handleSpan) return;

  const wl = isWhitelisted(username);
  const btn = document.createElement('button');
  btn.id = 'xopt-profile-btn';
  btn.textContent = wl ? '✓' : '+ Whitelist';
  btn.title = wl ? 'Whitelisted — click to remove' : 'Whitelist this account';
  btn.style.cssText = [
    'display:inline-block', 'width:fit-content', 'height:18px', 'padding:0 6px',
    'border-radius:9px', 'background:transparent',
    `border:1px solid ${wl ? '#2a4a2a' : '#2f3336'}`,
    `color:${wl ? '#4a7a4a' : '#536471'}`,
    'font-family:-apple-system,system-ui,sans-serif', 'font-size:11px', 'font-weight:500',
    'cursor:pointer', 'margin-left:6px', 'vertical-align:middle',
    'transition:border-color 0.1s,color 0.1s',
  ].join(';');

  btn.onmouseenter = () => { btn.style.borderColor = '#536471'; btn.style.color = '#e7e9ea'; };
  btn.onmouseleave = () => {
    const w = isWhitelisted(username);
    btn.style.borderColor = w ? '#2a4a2a' : '#2f3336';
    btn.style.color = w ? '#4a7a4a' : '#536471';
  };
  btn.onclick = (e) => {
    e.stopPropagation();
    rfToggleWhitelist(username);
    const w = isWhitelisted(username);
    btn.textContent = w ? '✓' : '+ Whitelist';
    btn.title = w ? 'Whitelisted — click to remove' : 'Whitelist this account';
    btn.style.borderColor = w ? '#2a4a2a' : '#2f3336';
    btn.style.color = w ? '#4a7a4a' : '#536471';
  };

  handleSpan.after(btn);
}
