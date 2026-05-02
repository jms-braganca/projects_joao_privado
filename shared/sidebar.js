/* ============================================================
   sidebar.js — Toggle hamburger + estado ativo automático
   ============================================================ */
(function() {
  'use strict';

  // ── Hamburger toggle ─────────────────────────────────────
  function setupHamburger() {
    var btn = document.querySelector('.hamburger');
    var sidebar = document.querySelector('.sidebar');
    var backdrop = document.querySelector('.sidebar-backdrop');
    if (!btn || !sidebar || !backdrop) return;

    function open()  { sidebar.classList.add('open'); backdrop.classList.add('open'); }
    function close() { sidebar.classList.remove('open'); backdrop.classList.remove('open'); }

    btn.addEventListener('click', function() {
      sidebar.classList.contains('open') ? close() : open();
    });
    backdrop.addEventListener('click', close);

    // Fecha ao clicar num link (UX mobile natural)
    sidebar.querySelectorAll('.sb-link').forEach(function(link) {
      link.addEventListener('click', function() {
        if (window.innerWidth <= 900) close();
      });
    });

    // Fecha no Esc
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') close();
    });
  }

  // ── Auto-marcar item ativo baseado na URL ─────────────────
  function markActive() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.sb-link[data-page]');
    links.forEach(function(link) {
      var page = link.dataset.page;
      // 'index' marca tanto index.html quanto raiz '/'
      var isActive = (page === path) ||
                     (page === 'index.html' && (path === '' || path === '/'));
      if (isActive) link.classList.add('active');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setupHamburger();
      markActive();
    });
  } else {
    setupHamburger();
    markActive();
  }
})();
