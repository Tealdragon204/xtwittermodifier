'use strict';

// ── Toast notifications ───────────────────────────────────────────
// Two independent toasts: one for hidden posts (filter), one for actions.

const _toastState = {
  filter: { el: null, timer: null, counts: {}, total: 0 },
  action: { el: null, timer: null, counts: {}, total: 0, lastAction: '' },
};

function _getOrCreateToast(key, bottomOffset) {
  const s = _toastState[key];
  if (s.el && s.el.isConnected) return s.el;

  const el = document.createElement('div');
  el.setAttribute('data-xopt-toast', key);
  el.style.cssText = [
    'position:fixed',
    `bottom:${bottomOffset}px`,
    'left:20%',
    'transform:translateX(-50%)',
    'background:#000',
    'border:1px solid #2f3336',
    'border-radius:6px',
    'padding:5px 12px',
    'font-family:-apple-system,system-ui,sans-serif',
    'font-size:11px',
    'color:#71767b',
    'z-index:99997',
    'pointer-events:none',
    'white-space:nowrap',
    'opacity:0',
    'transition:opacity 0.25s',
    'letter-spacing:0.02em',
  ].join(';');
  document.body.appendChild(el);
  s.el = el;
  requestAnimationFrame(() => requestAnimationFrame(() => el.style.opacity = '0.85'));
  return el;
}

function _dismissToast(key) {
  const s = _toastState[key];
  if (!s.el) return;
  s.el.style.opacity = '0';
  setTimeout(() => { s.el?.remove(); s.el = null; }, 280);
  s.counts = {};
  s.total = 0;
}

function _buildFilterLabel(counts, total) {
  const places = Object.keys(counts);
  if (total === 1) return `Post from ${places[0]} hidden`;
  if (places.length === 1) return `${total} posts from ${places[0]} hidden`;
  const shown = places.slice(0, 2).join(', ') + (places.length > 2 ? ` +${places.length - 2}` : '');
  return `${total} posts from ${shown} hidden`;
}

function _buildActionLabel(counts, total, action) {
  const places = Object.keys(counts);
  const verb = action === 'block' ? 'blocked' : 'muted';
  if (total === 1) return `Account from ${places[0]} ${verb}`;
  if (places.length === 1) return `${total} accounts from ${places[0]} ${verb}`;
  const shown = places.slice(0, 2).join(', ') + (places.length > 2 ? ` +${places.length - 2}` : '');
  return `${total} accounts from ${shown} ${verb}`;
}

function showFilterToast(country) {
  // _settings is the shared settings object from content/index.js
  if (!country || !_settings.showToasts) return;
  const s = _toastState.filter;
  s.counts[country] = (s.counts[country] || 0) + 1;
  s.total++;
  const el = _getOrCreateToast('filter', 56);
  el.textContent = _buildFilterLabel(s.counts, s.total);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => _dismissToast('filter'), 5000);
}

function showActionToast(country, action) {
  if (!country || !_settings.showToasts) return;
  const s = _toastState.action;
  s.counts[country] = (s.counts[country] || 0) + 1;
  s.total++;
  s.lastAction = action;
  const el = _getOrCreateToast('action', 32);
  el.textContent = _buildActionLabel(s.counts, s.total, action);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => _dismissToast('action'), 5000);
}
