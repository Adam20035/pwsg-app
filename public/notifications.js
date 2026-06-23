// ── Shared notification bell widget ──────────────────────────
(function() {
  const POLL_MS = 30000;
  let _interval = null;

  function initBell() {
    const nav = document.querySelector('nav .nav-links');
    if (!nav || document.getElementById('notif-bell')) return;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #notif-bell { position:relative; display:inline-flex; align-items:center; cursor:pointer; margin-right:4px; }
      #notif-bell .bell-icon { font-size:1.3rem; line-height:1; user-select:none; }
      #notif-badge { display:none; position:absolute; top:-6px; right:-8px;
        background:#e53e3e; color:#fff; font-size:.65rem; font-weight:700;
        min-width:18px; height:18px; border-radius:9px; text-align:center;
        line-height:18px; padding:0 4px; }
      #notif-dropdown { display:none; position:absolute; top:calc(100% + 10px); right:0;
        width:340px; max-height:420px; overflow-y:auto; background:#fff;
        border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,.12);
        z-index:9999; }
      #notif-dropdown-wrap { position:relative; }
      .notif-header { display:flex; justify-content:space-between; align-items:center;
        padding:12px 16px; border-bottom:1px solid #e2e8f0; }
      .notif-header strong { font-size:.95rem; color:#2d3748; }
      .notif-header button { background:none; border:none; color:#3182ce; cursor:pointer;
        font-size:.8rem; padding:0; }
      .notif-item { padding:12px 16px; border-bottom:1px solid #f7fafc; cursor:default;
        transition:background .15s; }
      .notif-item:last-child { border-bottom:none; }
      .notif-item.unread { background:#ebf8ff; }
      .notif-item:hover { background:#f0f4f8; }
      .notif-item-title { font-weight:600; font-size:.88rem; color:#2d3748; margin-bottom:3px; }
      .notif-item-msg { font-size:.82rem; color:#718096; }
      .notif-item-time { font-size:.75rem; color:#a0aec0; margin-top:4px; }
      .notif-empty { padding:24px; text-align:center; color:#a0aec0; font-size:.88rem; }
    `;
    document.head.appendChild(style);

    // Bell HTML
    const wrap = document.createElement('span');
    wrap.id = 'notif-dropdown-wrap';
    wrap.style.position = 'relative';
    wrap.innerHTML = `
      <span id="notif-bell" title="Powiadomienia">
        <span class="bell-icon">&#128276;</span>
        <span id="notif-badge"></span>
      </span>
      <div id="notif-dropdown">
        <div class="notif-header">
          <strong>Powiadomienia</strong>
          <button onclick="notifMarkAllRead()">Oznacz wszystkie jako przeczytane</button>
        </div>
        <div id="notif-list"><div class="notif-empty">Brak powiadomien</div></div>
      </div>
    `;

    // Insert before first link/button in nav-links
    const firstLink = nav.querySelector('a, button');
    if (firstLink) nav.insertBefore(wrap, firstLink);
    else nav.appendChild(wrap);

    document.getElementById('notif-bell').addEventListener('click', function(e) {
      e.stopPropagation();
      const dd = document.getElementById('notif-dropdown');
      const open = dd.style.display === 'block';
      dd.style.display = open ? 'none' : 'block';
      if (!open) loadNotifications();
    });
    document.addEventListener('click', function() {
      const dd = document.getElementById('notif-dropdown');
      if (dd) dd.style.display = 'none';
    });
    document.getElementById('notif-dropdown').addEventListener('click', e => e.stopPropagation());

    // Start polling
    loadNotifications();
    _interval = setInterval(loadNotifications, POLL_MS);
  }

  async function loadNotifications() {
    try {
      const r = await fetch('/api/notifications');
      if (!r.ok) return;
      const list = await r.json();
      renderNotifications(list);
    } catch (e) {}
  }

  function renderNotifications(list) {
    const badge = document.getElementById('notif-badge');
    const listEl = document.getElementById('notif-list');
    if (!badge || !listEl) return;

    const unread = list.filter(n => !n.read).length;
    if (unread > 0) {
      badge.style.display = 'block';
      badge.textContent = unread > 9 ? '9+' : unread;
    } else {
      badge.style.display = 'none';
    }

    if (!list.length) {
      listEl.innerHTML = '<div class="notif-empty">Brak powiadomien</div>';
      return;
    }

    listEl.innerHTML = list.map(n => {
      const ago = timeAgo(n.createdAt);
      return `<div class="notif-item${n.read ? '' : ' unread'}" onclick="notifMarkRead(${n.id}, this)">
        <div class="notif-item-title">${escHtml(n.title)}</div>
        <div class="notif-item-msg">${escHtml(n.message)}</div>
        <div class="notif-item-time">${ago}</div>
      </div>`;
    }).join('');
  }

  window.notifMarkRead = async function(id, el) {
    await fetch('/api/notifications/' + id + '/read', { method: 'POST' });
    if (el) el.classList.remove('unread');
    loadNotifications();
  };

  window.notifMarkAllRead = async function() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    loadNotifications();
  };

  function timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'przed chwilą';
    if (m < 60) return m + ' min temu';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' godz. temu';
    return Math.floor(h / 24) + ' dni temu';
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Init after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBell);
  } else {
    // Delay slightly so nav-links is populated (some pages build nav dynamically)
    setTimeout(initBell, 500);
  }
})();
