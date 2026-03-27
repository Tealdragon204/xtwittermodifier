'use strict';

// ── Settings Panel ────────────────────────────────────────────────
// Floating quick-access panel. Reads/writes to _rfSettings which
// is kept in sync with browser.storage.local via saveSettings().

let _panel = null;

function getUniqueRegions() {
  return [...new Set(Object.values(COUNTRY_DATA).map(d => d.region))].sort();
}

function togglePanel() {
  if (_panel) { _panel.remove(); _panel = null; return; }
  buildPanel();
}

function refreshPanelIfOpen() {
  if (_panel) renderBlockLists();
}

function buildPanel() {
  _panel = document.createElement('div');
  _panel.setAttribute('data-xopt-panel', '');
  _panel.style.cssText = `
    position:fixed;bottom:24px;left:20%;transform:translateX(-50%);
    width:300px;z-index:99999;background:#000;border:1px solid #2f3336;
    border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.8);
    font-family:-apple-system,system-ui,sans-serif;font-size:13px;color:#e7e9ea;
  `;

  _panel.innerHTML = `
    <div style="padding:12px 14px 10px;border-bottom:1px solid #2f3336;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600;font-size:13px;letter-spacing:0.03em;color:#71767b;text-transform:uppercase;">&#9670; XOpt</span>
      <span data-close style="cursor:pointer;color:#536471;font-size:18px;line-height:1;font-weight:300;">&#215;</span>
    </div>

    <div style="padding:11px 14px;">
      <label style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;margin-bottom:10px;">
        <span>Region Filter</span>
        <input type="checkbox" data-enabled style="width:14px;height:14px;cursor:pointer;accent-color:#1d9bf0;" ${_rfSettings.enabled ? 'checked' : ''}>
      </label>
      <label style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;margin-bottom:10px;">
        <span>Toasts</span>
        <input type="checkbox" data-show-toasts style="width:14px;height:14px;cursor:pointer;accent-color:#1d9bf0;" ${_rfSettings.showToasts ? 'checked' : ''}>
      </label>
      <div style="margin-bottom:10px;">
        <div style="margin-bottom:5px;color:#536471;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">Label format</div>
        <select data-display style="width:100%;background:#000;color:#e7e9ea;border:1px solid #2f3336;border-radius:6px;padding:6px 8px;font-size:12px;outline:none;">
          <option value="both"    ${_rfSettings.displayMode==='both'   ?'selected':''}>Flag · Country · Region</option>
          <option value="country" ${_rfSettings.displayMode==='country'?'selected':''}>Flag · Country only</option>
          <option value="region"  ${_rfSettings.displayMode==='region' ?'selected':''}>Flag · Region only</option>
        </select>
      </div>
      <div style="margin-bottom:10px;">
        <div style="margin-bottom:5px;color:#536471;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">When blocked</div>
        <select data-action style="width:100%;background:#000;color:#e7e9ea;border:1px solid #2f3336;border-radius:6px;padding:6px 8px;font-size:12px;outline:none;">
          <option value="hide" ${_rfSettings.filterAction==='hide'?'selected':''}>Hide completely</option>
          <option value="dim"  ${_rfSettings.filterAction==='dim' ?'selected':''}>Dim (still visible)</option>
        </select>
      </div>
      <div>
        <div style="margin-bottom:5px;color:#536471;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">Auto-action on blocked accounts</div>
        <select data-auto-action style="width:100%;background:#000;color:#e7e9ea;border:1px solid #2f3336;border-radius:6px;padding:6px 8px;font-size:12px;outline:none;">
          <option value="off"   ${_rfSettings.autoAction==='off'  ?'selected':''}>Off</option>
          <option value="mute"  ${_rfSettings.autoAction==='mute' ?'selected':''}>Auto-mute</option>
          <option value="block" ${_rfSettings.autoAction==='block'?'selected':''}>Auto-block</option>
        </select>
        <div style="margin-top:5px;display:flex;justify-content:space-between;align-items:center;">
          <span data-action-queue-count style="font-size:11px;color:#3a4550;"></span>
          <button data-view-action-log style="background:transparent;color:#536471;border:1px solid #2f3336;border-radius:5px;padding:3px 9px;cursor:pointer;font-size:11px;">View Log (0)</button>
        </div>
      </div>
    </div>

    <div style="border-top:1px solid #2f3336;padding:10px 14px;">
      <div style="font-weight:600;margin-bottom:7px;display:flex;align-items:center;gap:6px;font-size:12px;color:#71767b;text-transform:uppercase;letter-spacing:.04em;">
        Blocked Countries <span data-country-count style="font-weight:400;"></span>
      </div>
      <div data-country-list style="max-height:100px;overflow-y:auto;margin-bottom:7px;"></div>
      <div style="display:flex;gap:5px;">
        <input data-country-input type="text" placeholder="Country name…"
          style="flex:1;background:#000;color:#e7e9ea;border:1px solid #2f3336;border-radius:6px;padding:5px 8px;font-size:12px;outline:none;">
        <button data-country-add style="background:#1d9bf0;color:#fff;border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:12px;font-weight:600;">Add</button>
      </div>
    </div>

    <div style="border-top:1px solid #2f3336;padding:10px 14px;">
      <div style="font-weight:600;margin-bottom:7px;display:flex;align-items:center;gap:6px;font-size:12px;color:#71767b;text-transform:uppercase;letter-spacing:.04em;">
        Blocked Regions <span data-region-count style="font-weight:400;"></span>
      </div>
      <div data-region-list style="max-height:100px;overflow-y:auto;margin-bottom:7px;"></div>
      <div style="display:flex;gap:5px;">
        <select data-region-input style="flex:1;background:#000;color:#e7e9ea;border:1px solid #2f3336;border-radius:6px;padding:5px 8px;font-size:12px;outline:none;">
          <option value="">Select region…</option>
          ${getUniqueRegions().map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
        <button data-region-add style="background:#1d9bf0;color:#fff;border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:12px;font-weight:600;">Add</button>
      </div>
    </div>

    <div style="border-top:1px solid #2f3336;padding:10px 14px;">
      <div style="font-weight:600;margin-bottom:7px;display:flex;align-items:center;gap:6px;font-size:12px;color:#71767b;text-transform:uppercase;letter-spacing:.04em;">
        Whitelisted Accounts <span data-whitelist-count style="font-weight:400;"></span>
      </div>
      <div data-whitelist-list style="max-height:100px;overflow-y:auto;margin-bottom:7px;"></div>
      <div style="display:flex;gap:5px;margin-bottom:6px;">
        <input data-whitelist-input type="text" placeholder="@username…"
          style="flex:1;background:#000;color:#e7e9ea;border:1px solid #2f3336;border-radius:6px;padding:5px 8px;font-size:12px;outline:none;">
        <button data-whitelist-add style="background:#1d9bf0;color:#fff;border:none;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:12px;font-weight:600;">Add</button>
      </div>
      <button data-whitelist-visible style="width:100%;background:transparent;color:#536471;border:1px solid #2f3336;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:11px;text-align:left;">
        + Whitelist all visible accounts on current page
      </button>
    </div>

    <div style="border-top:1px solid #2f3336;padding:10px 14px;">
      <div style="margin-bottom:6px;color:#536471;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">Cache size limit</div>
      <select data-cache-size style="width:100%;background:#000;color:#e7e9ea;border:1px solid #2f3336;border-radius:6px;padding:6px 8px;font-size:12px;outline:none;">
        <option value="128"   ${_rfSettings.cacheMaxSize===128   ?'selected':''}>128 accounts</option>
        <option value="256"   ${_rfSettings.cacheMaxSize===256   ?'selected':''}>256 accounts</option>
        <option value="512"   ${_rfSettings.cacheMaxSize===512   ?'selected':''}>512 accounts</option>
        <option value="1024"  ${_rfSettings.cacheMaxSize===1024  ?'selected':''}>1,024 accounts</option>
        <option value="2048"  ${_rfSettings.cacheMaxSize===2048  ?'selected':''}>2,048 accounts</option>
        <option value="4096"  ${_rfSettings.cacheMaxSize===4096  ?'selected':''}>4,096 accounts</option>
        <option value="8192"  ${_rfSettings.cacheMaxSize===8192  ?'selected':''}>8,192 accounts</option>
        <option value="16384" ${_rfSettings.cacheMaxSize===16384 ?'selected':''}>16,384 accounts</option>
        <option value="32768" ${_rfSettings.cacheMaxSize===32768 ?'selected':''}>32,768 accounts</option>
      </select>
    </div>

    <div style="border-top:1px solid #2f3336;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
      <span data-cache-count style="font-size:11px;color:#3a4550;flex:1;"></span>
      <button data-view-cache style="background:transparent;color:#536471;border:1px solid #2f3336;border-radius:5px;padding:3px 9px;cursor:pointer;font-size:11px;">View</button>
      <button data-clear-cache style="background:transparent;color:#536471;border:1px solid #2f3336;border-radius:5px;padding:3px 9px;cursor:pointer;font-size:11px;">Clear</button>
    </div>
  `;

  renderBlockLists();

  _panel.querySelector('[data-close]').onclick = togglePanel;

  _panel.querySelector('[data-enabled]').onchange = (e) => {
    _rfSettings.enabled = e.target.checked;
    saveSettings(_rfSettings);
    reapplyAll();
    if (_rfSettings.enabled) rfRescanAll();
  };

  _panel.querySelector('[data-show-toasts]').onchange = (e) => {
    _rfSettings.showToasts = e.target.checked;
    saveSettings(_rfSettings);
  };

  _panel.querySelector('[data-display]').onchange = (e) => {
    _rfSettings.displayMode = e.target.value;
    saveSettings(_rfSettings);
    reapplyAll();
  };

  _panel.querySelector('[data-action]').onchange = (e) => {
    _rfSettings.filterAction = e.target.value;
    saveSettings(_rfSettings);
    reapplyAll();
  };

  _panel.querySelector('[data-auto-action]').onchange = (e) => {
    _rfSettings.autoAction = e.target.value;
    saveSettings(_rfSettings);
  };

  _panel.querySelector('[data-view-action-log]').onclick = showActionLog;

  _panel.querySelector('[data-country-add]').onclick = _addCountry;
  _panel.querySelector('[data-country-input]').onkeydown = (e) => { if (e.key === 'Enter') _addCountry(); };

  _panel.querySelector('[data-region-add]').onclick = () => {
    const sel = _panel.querySelector('[data-region-input]');
    const val = sel.value;
    if (val && !_rfSettings.blockedRegions.includes(val)) {
      _rfSettings.blockedRegions.push(val);
      saveSettings(_rfSettings); reapplyAll(); renderBlockLists();
      sel.value = '';
    }
  };

  _panel.querySelector('[data-whitelist-add]').onclick = _addWhitelist;
  _panel.querySelector('[data-whitelist-input]').onkeydown = (e) => { if (e.key === 'Enter') _addWhitelist(); };

  _panel.querySelector('[data-whitelist-visible]').onclick = () => {
    const seen = new Set();
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      const m1 = href?.match(/^\/([A-Za-z0-9_]{1,15})$/);
      if (m1) seen.add(m1[1].toLowerCase());
      const m2 = href?.match(/^https?:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})$/);
      if (m2) seen.add(m2[1].toLowerCase());
    });
    ['home','explore','notifications','messages','search','settings','i','compose'].forEach(s => seen.delete(s));
    let added = 0;
    for (const u of seen) {
      if (!_rfSettings.whitelistedAccounts.includes(u)) {
        _rfSettings.whitelistedAccounts.push(u);
        added++;
      }
    }
    saveSettings(_rfSettings); reapplyAll(); renderBlockLists();
    const btn = _panel.querySelector('[data-whitelist-visible]');
    btn.textContent = `✓ Added ${added} account${added !== 1 ? 's' : ''}`;
    setTimeout(() => { if (_panel) btn.textContent = '+ Whitelist all visible accounts on current page'; }, 2500);
  };

  _panel.querySelector('[data-cache-size]').onchange = (e) => {
    _rfSettings.cacheMaxSize = parseInt(e.target.value, 10);
    saveSettings(_rfSettings);
    renderBlockLists();
  };

  _panel.querySelector('[data-view-cache]').onclick = showCacheViewer;

  _panel.querySelector('[data-clear-cache]').onclick = () => {
    if (!confirm('Clear all cached location data? Badges will reload on next scroll.')) return;
    browser.runtime.sendMessage({ type: 'CLEAR_CACHE' });
    renderBlockLists();
    rfRescanAll();
  };

  document.body.appendChild(_panel);
}

function _addCountry() {
  if (!_panel) return;
  const input = _panel.querySelector('[data-country-input]');
  const val = input.value.trim();
  if (val && !_rfSettings.blockedCountries.includes(val)) {
    _rfSettings.blockedCountries.push(val);
    saveSettings(_rfSettings); reapplyAll(); renderBlockLists();
    input.value = '';
  }
}

function _addWhitelist() {
  if (!_panel) return;
  const input = _panel.querySelector('[data-whitelist-input]');
  const val = input.value.trim().replace(/^@/, '').toLowerCase();
  if (val && !_rfSettings.whitelistedAccounts.includes(val)) {
    _rfSettings.whitelistedAccounts.push(val);
    saveSettings(_rfSettings); reapplyAll(); renderBlockLists();
    input.value = '';
  }
}

function renderBlockLists() {
  if (!_panel) return;

  const cList = _panel.querySelector('[data-country-list]');
  const rList = _panel.querySelector('[data-region-list]');
  const wList = _panel.querySelector('[data-whitelist-list]');

  cList.innerHTML = _rfSettings.blockedCountries.length
    ? _rfSettings.blockedCountries.map(c => {
        const d = COUNTRY_DATA[c];
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;color:#e7e9ea;">
          <span>${d?.flag || '&#9675;'} ${c}</span>
          <span data-rm-country="${c}" style="cursor:pointer;color:#536471;padding:0 3px;font-size:13px;font-weight:300;" title="Remove">&#215;</span>
        </div>`;
      }).join('')
    : '<span style="color:#3a4550;font-size:12px;">None</span>';

  rList.innerHTML = _rfSettings.blockedRegions.length
    ? _rfSettings.blockedRegions.map(r =>
        `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;color:#e7e9ea;">
          <span>${r}</span>
          <span data-rm-region="${r}" style="cursor:pointer;color:#536471;padding:0 3px;font-size:13px;font-weight:300;" title="Remove">&#215;</span>
        </div>`
      ).join('')
    : '<span style="color:#3a4550;font-size:12px;">None</span>';

  if (wList) {
    wList.innerHTML = _rfSettings.whitelistedAccounts.length
      ? _rfSettings.whitelistedAccounts.map(u =>
          `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;color:#4a7a4a;">
            <a href="https://x.com/${u}" target="_blank" style="color:#4a7a4a;text-decoration:none;">@${u}</a>
            <span data-rm-whitelist="${u}" style="cursor:pointer;color:#536471;padding:0 3px;font-size:13px;font-weight:300;" title="Remove">&#215;</span>
          </div>`
        ).join('')
      : '<span style="color:#3a4550;font-size:12px;">None</span>';
    _panel.querySelector('[data-whitelist-count]').textContent = `(${_rfSettings.whitelistedAccounts.length})`;
    wList.querySelectorAll('[data-rm-whitelist]').forEach(el => {
      el.onclick = () => {
        _rfSettings.whitelistedAccounts = _rfSettings.whitelistedAccounts.filter(x => x !== el.dataset.rmWhitelist);
        saveSettings(_rfSettings); reapplyAll(); renderBlockLists();
      };
    });
  }

  _panel.querySelector('[data-country-count]').textContent = `(${_rfSettings.blockedCountries.length})`;
  _panel.querySelector('[data-region-count]').textContent  = `(${_rfSettings.blockedRegions.length})`;

  // Get cache count from background
  browser.runtime.sendMessage({ type: 'GET_CACHE' }).then(resp => {
    const total = resp?.cache ? Object.keys(resp.cache).length : 0;
    const max   = _rfSettings.cacheMaxSize || 512;
    if (_panel) _panel.querySelector('[data-cache-count]').textContent = `${total} / ${max} cached`;
  }).catch(() => {});

  // Get action state from background
  browser.runtime.sendMessage({ type: 'GET_ACTION_STATE' }).then(resp => {
    if (!_panel || !resp) return;
    const { actionQueue = [], actionLog = {} } = resp;
    const done    = Object.values(actionLog).filter(e => e.status === 'done').length;
    const failed  = Object.values(actionLog).filter(e => e.status !== 'done').length;
    const pending = actionQueue.length;
    const muted   = Object.values(actionLog).filter(e => e.status === 'done' && e.action === 'mute').length;
    const blocked = Object.values(actionLog).filter(e => e.status === 'done' && e.action === 'block').length;
    let summary = [];
    if (blocked) summary.push(`${blocked} blocked`);
    if (muted)   summary.push(`${muted} muted`);
    if (pending) summary.push(`${pending} queued`);
    if (failed)  summary.push(`${failed} failed`);
    const aqEl = _panel.querySelector('[data-action-queue-count]');
    if (aqEl) aqEl.textContent = summary.length ? summary.join(' · ') : '0 actions taken';
    const logBtn = _panel.querySelector('[data-view-action-log]');
    if (logBtn) logBtn.textContent = `View Log (${done + failed})`;
  }).catch(() => {});

  _panel.querySelectorAll('[data-rm-country]').forEach(el => {
    el.onclick = () => {
      _rfSettings.blockedCountries = _rfSettings.blockedCountries.filter(x => x !== el.dataset.rmCountry);
      saveSettings(_rfSettings); reapplyAll(); renderBlockLists();
    };
  });

  _panel.querySelectorAll('[data-rm-region]').forEach(el => {
    el.onclick = () => {
      _rfSettings.blockedRegions = _rfSettings.blockedRegions.filter(x => x !== el.dataset.rmRegion);
      saveSettings(_rfSettings); reapplyAll(); renderBlockLists();
    };
  });
}

// ── Cache viewer ──────────────────────────────────────────────────

function showCacheViewer() {
  document.getElementById('xopt-cache-viewer')?.remove();

  browser.runtime.sendMessage({ type: 'GET_CACHE' }).then(resp => {
    const cache = resp?.cache || {};
    const entries = Object.entries(cache)
      .map(([name, e]) => ({ name, ...e }))
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

    const viewer = document.createElement('div');
    viewer.id = 'xopt-cache-viewer';
    viewer.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:calc(20% + 160px)',
      'width:340px', 'max-height:480px', 'z-index:99999',
      'background:#000', 'border:1px solid #2f3336', 'border-radius:10px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.8)',
      'font-family:-apple-system,system-ui,sans-serif', 'font-size:12px', 'color:#e7e9ea',
      'display:flex', 'flex-direction:column',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'padding:10px 14px;border-bottom:1px solid #2f3336;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
    header.innerHTML = `
      <span style="color:#71767b;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">Cache &mdash; ${entries.length} entries</span>
      <span style="cursor:pointer;color:#536471;font-size:18px;line-height:1;">&#215;</span>
    `;
    header.querySelector('span:last-child').onclick = () => viewer.remove();

    const searchWrap = document.createElement('div');
    searchWrap.style.cssText = 'padding:6px 14px;border-bottom:1px solid #2f3336;flex-shrink:0;';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search @username…';
    searchInput.style.cssText = 'width:100%;background:#000;color:#e7e9ea;border:1px solid #2f3336;border-radius:5px;padding:4px 8px;font-size:12px;outline:none;box-sizing:border-box;';
    searchWrap.appendChild(searchInput);

    // Per-country stats (collapsible)
    const counts = {};
    for (const e of entries) {
      if (!e.country) continue;
      counts[e.country] = (counts[e.country] || 0) + 1;
    }
    let statsOpen = false;
    if (Object.keys(counts).length) {
      const statsSection = document.createElement('div');
      statsSection.style.cssText = 'flex-shrink:0;border-bottom:1px solid #2f3336;';
      const statsToggle = document.createElement('div');
      statsToggle.style.cssText = 'padding:5px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;';
      statsToggle.innerHTML = `
        <span style="color:#536471;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Countries (${Object.keys(counts).length})</span>
        <span style="color:#536471;font-size:10px;">&#9660;</span>
      `;
      const statsBody = document.createElement('div');
      statsBody.style.cssText = 'display:none;padding:4px 14px 6px;flex-wrap:wrap;gap:4px;';
      for (const [country, count] of Object.entries(counts).sort((a,b) => b[1]-a[1])) {
        const d = COUNTRY_DATA[country];
        const pill = document.createElement('span');
        pill.style.cssText = 'font-size:10px;color:#536471;background:#0d0d0d;border:1px solid #2f3336;border-radius:4px;padding:1px 5px;cursor:pointer;';
        pill.textContent = `${d?.flag || ''} ${country} ${count}`;
        pill.onclick = () => { searchInput.value = country; searchInput.dispatchEvent(new Event('input')); };
        statsBody.appendChild(pill);
      }
      statsToggle.onclick = () => {
        statsOpen = !statsOpen;
        statsBody.style.display = statsOpen ? 'flex' : 'none';
        statsToggle.querySelector('span:last-child').innerHTML = statsOpen ? '&#9650;' : '&#9660;';
      };
      statsSection.appendChild(statsToggle);
      statsSection.appendChild(statsBody);
      viewer.appendChild(header);
      viewer.appendChild(searchWrap);
      viewer.appendChild(statsSection);
    } else {
      viewer.appendChild(header);
      viewer.appendChild(searchWrap);
    }

    const body = document.createElement('div');
    body.style.cssText = 'overflow-y:auto;padding:4px 0;flex:1;';

    function renderRows(filter) {
      body.innerHTML = '';
      const now = Date.now();
      const q = filter.replace(/^@/, '').toLowerCase();
      const visible = q ? entries.filter(e => e.name.toLowerCase().includes(q) || (e.country || '').toLowerCase().includes(q)) : entries;
      if (!visible.length) {
        body.innerHTML = '<div style="padding:12px 14px;color:#3a4550;">No matches.</div>';
        return;
      }
      for (const e of visible) {
        const d = e.country ? COUNTRY_DATA[e.country] : null;
        const ageDays = e.queriedAt ? Math.round((now - e.queriedAt) / 86400000) : '?';
        const stale = e.queriedAt && (now - e.queriedAt) > CACHE_TTL;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;padding:4px 14px;gap:8px;';
        row.innerHTML = `
          <a href="https://x.com/${e.name}" target="_blank" style="color:#71767b;flex-shrink:0;min-width:110px;text-decoration:none;">@${e.name}</a>
          <span style="flex:1;">${d?.flag || ''} ${e.country || '<span style="color:#3a4550">—</span>'}</span>
          <span style="color:#536471;flex-shrink:0;font-size:11px;">${d?.region || ''}</span>
          <span style="color:${stale ? '#e04444' : '#3a4550'};flex-shrink:0;font-size:10px;">${ageDays}d</span>
        `;
        body.appendChild(row);
      }
    }

    if (!entries.length) body.innerHTML = '<div style="padding:12px 14px;color:#3a4550;">No cached entries yet.</div>';
    else renderRows('');

    searchInput.oninput = () => renderRows(searchInput.value);
    viewer.appendChild(body);
    document.body.appendChild(viewer);
    searchInput.focus();
  });
}

// ── Action log ────────────────────────────────────────────────────

function showActionLog() {
  document.getElementById('xopt-action-log')?.remove();

  browser.runtime.sendMessage({ type: 'GET_ACTION_STATE' }).then(resp => {
    const { actionQueue = [], actionLog = {} } = resp || {};
    const entries = Object.entries(actionLog).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    const viewer = document.createElement('div');
    viewer.id = 'xopt-action-log';
    viewer.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:calc(20% + 160px)',
      'width:360px', 'max-height:480px', 'z-index:99999',
      'background:#000', 'border:1px solid #2f3336', 'border-radius:10px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.8)',
      'font-family:-apple-system,system-ui,sans-serif', 'font-size:12px', 'color:#e7e9ea',
      'display:flex', 'flex-direction:column',
    ].join(';');

    const pending = actionQueue.length;
    const muted   = entries.filter(([,e]) => e.status === 'done' && e.action === 'mute').length;
    const blocked = entries.filter(([,e]) => e.status === 'done' && e.action === 'block').length;
    const failed  = entries.filter(([,e]) => e.status !== 'done').length;
    const parts = [];
    if (blocked) parts.push(`${blocked} blocked`);
    if (muted)   parts.push(`${muted} muted`);
    if (pending) parts.push(`${pending} queued`);
    if (failed)  parts.push(`${failed} failed`);
    const summary = parts.length ? parts.join(' · ') : 'no actions yet';

    const header = document.createElement('div');
    header.style.cssText = 'padding:10px 14px;border-bottom:1px solid #2f3336;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;';
    header.innerHTML = `
      <span style="color:#71767b;font-size:11px;text-transform:uppercase;letter-spacing:.06em;">${summary}</span>
      <span style="cursor:pointer;color:#536471;font-size:18px;line-height:1;">&#215;</span>
    `;
    header.querySelector('span:last-child').onclick = () => viewer.remove();

    const body = document.createElement('div');
    body.style.cssText = 'overflow-y:auto;padding:4px 0;flex:1;';

    // Per-country stats — collapsible (fix from build plan)
    const doneEntries = entries.filter(([,e]) => e.status === 'done' && e.country);
    if (doneEntries.length) {
      const countryCounts = {};
      for (const [,e] of doneEntries) {
        const d = COUNTRY_DATA[e.country];
        const label = (d?.flag ? d.flag + ' ' : '') + e.country;
        countryCounts[label] = (countryCounts[label] || 0) + 1;
      }
      let statsOpen = false;
      const statsSection = document.createElement('div');
      statsSection.style.cssText = 'border-bottom:1px solid #2f3336;flex-shrink:0;';
      const statsToggle = document.createElement('div');
      statsToggle.style.cssText = 'padding:5px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;';
      statsToggle.innerHTML = `
        <span style="color:#536471;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">By country (${Object.keys(countryCounts).length})</span>
        <span style="color:#536471;font-size:10px;">&#9660;</span>
      `;
      const statsBody = document.createElement('div');
      statsBody.style.cssText = 'display:none;padding:4px 14px 6px;flex-wrap:wrap;gap:4px;';
      for (const [label, count] of Object.entries(countryCounts).sort((a,b) => b[1]-a[1])) {
        const pill = document.createElement('span');
        pill.style.cssText = 'font-size:10px;color:#536471;background:#0d0d0d;border:1px solid #2f3336;border-radius:4px;padding:1px 5px;';
        pill.textContent = `${label} ${count}`;
        statsBody.appendChild(pill);
      }
      statsToggle.onclick = () => {
        statsOpen = !statsOpen;
        statsBody.style.display = statsOpen ? 'flex' : 'none';
        statsToggle.querySelector('span:last-child').innerHTML = statsOpen ? '&#9650;' : '&#9660;';
      };
      statsSection.appendChild(statsToggle);
      statsSection.appendChild(statsBody);
      body.appendChild(statsSection);
    }

    // Queued entries
    for (const { username, action, country } of actionQueue) {
      const d = country ? COUNTRY_DATA[country] : null;
      const countryStr = country ? ` · ${d?.flag || ''} ${country}` : '';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:4px 14px;gap:8px;';
      row.innerHTML = `
        <a href="https://x.com/${username}" target="_blank" style="color:#71767b;flex-shrink:0;text-decoration:none;">@${username}</a>
        <span style="flex:1;color:#3a4a5a;font-size:10px;text-align:right;">${action}${countryStr}</span>
        <span style="color:#2a3a4a;font-size:10px;flex-shrink:0;">queued</span>
      `;
      body.appendChild(row);
    }

    if (!entries.length && !actionQueue.length) {
      body.innerHTML = '<div style="padding:12px 14px;color:#3a4550;font-size:12px;">No actions yet — enable auto-mute or auto-block in the panel.</div>';
    } else {
      const now = Date.now();
      for (const [username, e] of entries) {
        const ageMins = Math.round((now - (e.timestamp || 0)) / 60000);
        const ageStr = ageMins < 60 ? `${ageMins}m ago` : `${Math.round(ageMins/60)}h ago`;
        const colour = e.status === 'done' ? '#4a7a4a' : '#7a4a4a';
        const d = e.country ? COUNTRY_DATA[e.country] : null;
        const countryStr = e.country ? `${d?.flag || ''} ${e.country}` : '—';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;padding:4px 14px;gap:8px;';
        row.innerHTML = `
          <a href="https://x.com/${username}" target="_blank" style="color:#71767b;flex-shrink:0;text-decoration:none;min-width:100px;">@${username}</a>
          <span style="flex:1;color:#536471;font-size:11px;">${countryStr}</span>
          <span style="color:#536471;font-size:10px;flex-shrink:0;">${e.action}</span>
          <span style="color:${colour};flex-shrink:0;font-size:10px;">${e.status}</span>
          <span style="color:#3a4550;flex-shrink:0;font-size:10px;">${ageStr}</span>
        `;
        body.appendChild(row);
      }
    }

    viewer.appendChild(header);
    viewer.appendChild(body);
    document.body.appendChild(viewer);
  });
}
