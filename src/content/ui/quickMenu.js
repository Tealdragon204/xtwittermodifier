'use strict';

// ── Toggle button ─────────────────────────────────────────────────
// Bottom-of-screen tab that opens the quick-access panel.

function createToggleButton() {
  const btn = document.createElement('button');
  btn.setAttribute('data-xopt-toggle', '');
  btn.title = 'XOpt';
  btn.style.cssText = [
    'position:fixed', 'bottom:0', 'left:20%', 'transform:translateX(-50%)',
    'height:24px', 'padding:0 12px', 'border-radius:4px 4px 0 0',
    'background:#000', 'border:1px solid #2f3336', 'border-bottom:none',
    'color:#536471', 'font-family:-apple-system,system-ui,sans-serif',
    'font-size:11px', 'font-weight:500', 'letter-spacing:0.06em',
    'cursor:pointer', 'z-index:99998',
    'display:flex', 'align-items:center', 'gap:6px',
    'white-space:nowrap', 'transition:border-color 0.1s,color 0.1s',
  ].join(';');

  const label = document.createElement('span');
  label.textContent = '\u25C8 XOPT';

  const counter = document.createElement('span');
  counter.setAttribute('data-xopt-queue-count', '');
  counter.style.cssText = 'font-size:10px;opacity:0;transition:opacity 0.2s;background:#1d3040;border-radius:3px;padding:1px 5px;';

  const actionCounter = document.createElement('span');
  actionCounter.setAttribute('data-xopt-action-count', '');
  actionCounter.style.cssText = 'font-size:10px;opacity:0;transition:opacity 0.2s;background:#3a1010;border-radius:3px;padding:1px 5px;';

  btn.appendChild(label);
  btn.appendChild(counter);
  btn.appendChild(actionCounter);

  btn.onmouseenter = () => { btn.style.borderColor = '#536471'; btn.style.color = '#e7e9ea'; };
  btn.onmouseleave = () => { btn.style.borderColor = '#2f3336'; btn.style.color = '#536471'; };
  btn.onclick = togglePanel;
  document.body.appendChild(btn);

  // Poll background for queue status to update counters
  setInterval(() => {
    browser.runtime.sendMessage({ type: 'GET_QUEUE_STATUS' }).then(resp => {
      if (!resp) return;
      const n = (resp.queueLength || 0) + (resp.activeCount || 0);
      if (resp.isRateLimited) {
        counter.textContent = n + ' throttled';
        counter.style.opacity = '1';
        counter.style.background = '#3a2a00';
      } else {
        counter.textContent = n > 0 ? n + ' pending' : '';
        counter.style.opacity = n > 0 ? '1' : '0';
        counter.style.background = '#1d3040';
      }
    }).catch(() => {});

    browser.runtime.sendMessage({ type: 'GET_ACTION_STATE' }).then(resp => {
      if (!resp) return;
      const a = (resp.actionQueue?.length || 0) + (resp.actionActive ? 1 : 0);
      const action = _settings.autoAction;
      actionCounter.textContent = a > 0 ? a + (action === 'block' ? ' blocking' : ' muting') : '';
      actionCounter.style.opacity = a > 0 ? '1' : '0';
    }).catch(() => {});
  }, 1000);
}
