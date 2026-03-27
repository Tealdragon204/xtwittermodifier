'use strict';

// ── MutationObserver coordinator ──────────────────────────────────
// Single observer for the entire content script. Feature modules
// register callbacks here instead of creating their own observers.

const _observerCallbacks = [];
let _observerDebounce = null;
let _observer = null;

function registerObserverCallback(fn) {
  _observerCallbacks.push(fn);
}

function startObserver() {
  if (_observer) return; // already running
  _observer = new MutationObserver(() => {
    clearTimeout(_observerDebounce);
    _observerDebounce = setTimeout(() => {
      _observerCallbacks.forEach(fn => { try { fn(); } catch (e) { dbg('Observer callback error:', e); } });
    }, 250);
  });
  _observer.observe(document.body, { childList: true, subtree: true });
  dbg('MutationObserver started');
}
