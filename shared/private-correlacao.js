/* ============================================================
   private-correlacao.js — Página dedicada de correlação
   ============================================================
   Espera window.DADOS_CORR = {
     items: [{id, nome, classe, tipo}, ...],   // fundos + 'cdi' + 'ibov'
     corr12m: [[...]],
     corr24m: [[...]],
     classes: {...}, meta: {...}
   }

   Fluxo: usuário escolhe manualmente os fundos (abas Fundos / Prev) +
   ativa benchmarks. Heatmap renderiza só com a seleção.
   ============================================================ */
(function () {
  'use strict';

  if (!window.DADOS_CORR || !window.DADOS_CORR.items) {
    console.error('window.DADOS_CORR ausente.');
    return;
  }
  var DC = window.DADOS_CORR;

  // estado
  var aba          = 'fundo';            // 'fundo' | 'prev'
  var selecionados = new Set();          // ids (cnpjs) selecionados
  var query        = '';
  var janela       = '12m';
  var benchCdi     = false;
  var benchIbov    = false;
  var tooltipEl;

  // mapa rápido id → índice na matriz
  var idx = {};
  DC.items.forEach(function (it, i) { idx[it.id] = i; });

  function ready(fn) {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    setupTooltip();
    setupTabs();
    setupSearch();
    setupWindow();
    setupBenchmarks();
    setupReset();
    renderList();
    renderChips();
    renderHeatmap();
  });

  /* -------- abas Fundos/Prev -------------------- */
  function setupTabs() {
    var tabs = document.querySelectorAll('.cor-tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('is-selected'); });
        t.classList.add('is-selected');
        aba = t.dataset.tipo || 'fundo';
        renderList();
      });
    });
  }

  /* -------- search ------------------------------ */
  function setupSearch() {
    var input = document.getElementById('corSearch');
    if (!input) return;
    input.addEventListener('input', function () {
      query = input.value.trim().toLowerCase();
      renderList();
    });
  }

  /* -------- janela ------------------------------ */
  function setupWindow() {
    var seg = document.getElementById('corWindow');
    if (!seg) return;
    seg.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        seg.querySelectorAll('button').forEach(function (x) { x.classList.remove('is-selected'); });
        b.classList.add('is-selected');
        janela = b.dataset.window || '12m';
        renderHeatmap();
      });
    });
  }

  /* -------- toggles benchmark ------------------- */
  function setupBenchmarks() {
    var inCdi  = document.getElementById('corBenchCdi');
    var inIbov = document.getElementById('corBenchIbov');
    if (inCdi)  inCdi.addEventListener('change',  function () { benchCdi  = inCdi.checked;  renderHeatmap(); });
    if (inIbov) inIbov.addEventListener('change', function () { benchIbov = inIbov.checked; renderHeatmap(); });
  }

  /* -------- reset ------------------------------- */
  function setupReset() {
    var btn = document.getElementById('corReset');
    if (!btn) return;
    btn.addEventListener('click', function () {
      selecionados.clear();
      renderList(); renderChips(); renderHeatmap();
    });
  }

  /* -------- lista de fundos da aba -------------- */
  function renderList() {
    var ul = document.getElementById('corFundList');
    if (!ul) return;
    ul.innerHTML = '';

    var max = 200;
    var n = 0;
    DC.items.forEach(function (it) {
      if (n >= max) return;
      if (it.tipo !== aba) return;
      if (query) {
        var hay = (it.nome + ' ' + it.id).toLowerCase();
        if (hay.indexOf(query) === -1) return;
      }
      var row = document.createElement('div');
      var sel = selecionados.has(it.id);
      row.className = 'cor-fund-item' + (sel ? ' is-selected' : '');
      row.innerHTML =
        '<span class="check"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6 5 9 10 3"/></svg></span>' +
        '<div class="info">' +
          '<span class="nome">' + escHtml(it.nome) + '</span>' +
          '<span class="meta">' + escHtml(it.classe) + '</span>' +
        '</div>';
      row.addEventListener('click', function () {
        if (selecionados.has(it.id)) selecionados.delete(it.id);
        else                          selecionados.add(it.id);
        renderList(); renderChips(); renderHeatmap();
      });
      ul.appendChild(row);
      n++;
    });

    if (n === 0) {
      var empty = document.createElement('div');
      empty.className = 'cor-empty-chips';
      empty.textContent = query ? 'Nenhum fundo encontrado.' : 'Nenhum fundo nesta aba.';
      ul.appendChild(empty);
    }
  }

  /* -------- chips dos selecionados -------------- */
  function renderChips() {
    var wrap = document.getElementById('corChips');
    var count = document.getElementById('corCount');
    if (count) count.textContent = String(selecionados.size);
    if (!wrap) return;
    wrap.innerHTML = '';
    if (selecionados.size === 0) {
      var empty = document.createElement('div');
      empty.className = 'cor-empty-chips';
      empty.textContent = 'Nenhum fundo selecionado. Use a busca abaixo.';
      wrap.appendChild(empty);
      return;
    }
    Array.from(selecionados).forEach(function (id) {
      var it = DC.items[idx[id]];
      if (!it) return;
      var chip = document.createElement('div');
      chip.className = 'cmp-chip';
      chip.innerHTML =
        '<span class="cmp-chip-dot" style="background:rgba(0,113,227,0.6)"></span>' +
        '<span class="cmp-chip-name" title="' + escHtml(it.nome) + '">' + escHtml(it.nome) + '</span>' +
        '<button class="cmp-chip-x" aria-label="Remover">×</button>';
      chip.querySelector('.cmp-chip-x').addEventListener('click', function () {
        selecionados.delete(id);
        renderList(); renderChips(); renderHeatmap();
      });
      wrap.appendChild(chip);
    });
  }

  /* -------- heatmap SVG ------------------------- */
  function renderHeatmap() {
    var wrap = document.getElementById('corHeatmap');
    var summary = document.getElementById('corSummary');
    if (!wrap) return;

    // monta a lista de itens visíveis: selecionados + benchmarks ativos
    var visible = [];
    selecionados.forEach(function (id) {
      var i = idx[id];
      if (i != null) visible.push(i);
    });
    if (benchCdi  && idx['cdi']  != null) visible.push(idx['cdi']);
    if (benchIbov && idx['ibov'] != null) visible.push(idx['ibov']);

    var n = visible.length;

    if (summary) {
      var nFund  = visible.filter(function (i) { return DC.items[i].tipo !== 'benchmark'; }).length;
      var nBench = n - nFund;
      summary.innerHTML =
        '<span><strong>' + nFund + '</strong> fundo' + (nFund !== 1 ? 's' : '') + ' selecionado' + (nFund !== 1 ? 's' : '') + '</span>' +
        (nBench ? '<span>+ <strong>' + nBench + '</strong> benchmark' + (nBench>1?'s':'') + '</span>' : '') +
        '<span>janela <strong>' + (janela === '24m' ? '24 meses' : '12 meses') + '</strong></span>';
    }

    if (n < 2) {
      wrap.innerHTML = '<div class="cor-empty"><p class="empty-title">Selecione ao menos 2 itens.</p>' +
                       '<p>Escolha fundos na lista à esquerda ou ative os benchmarks.</p></div>';
      return;
    }

    var corr = janela === '24m' ? DC.corr24m : DC.corr12m;
    // contagem de meses comuns por par — usada para marcar amostras pequenas.
    // Compat: payloads antigos podem não trazer nobs*; fallback dummy.
    var nobs = janela === '24m' ? (DC.nobs24m || null) : (DC.nobs12m || null);
    // Limiar de "amostra confortável" (mesma regra do Python: max(3, int(jan*0.6))).
    var minPts = (janela === '24m') ? 14 : 7;

    // Layout SVG dinâmico
    var labelLeft = 240;
    var labelTop  = 220;
    var cellSize  = pickCellSize(n);
    var w = labelLeft + n * cellSize + 8;
    var h = labelTop  + n * cellSize + 8;

    var parts = [];
    parts.push('<svg class="cor-svg" viewBox="0 0 ' + w + ' ' + h +
               '" xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">');

    // header (col labels rotacionados)
    visible.forEach(function (idC, j) {
      var it = DC.items[idC];
      var cx = labelLeft + j * cellSize + cellSize / 2;
      var cy = labelTop - 6;
      var clsLabel = it.tipo === 'benchmark' ? 'col-label is-bench' : 'col-label';
      var text = truncate(it.nome, 28);
      parts.push(
        '<text class="' + clsLabel + '" x="' + cx + '" y="' + cy +
        '" transform="rotate(-60 ' + cx + ',' + cy + ')">' +
        escHtml(text) + '</text>');
    });

    // row labels
    visible.forEach(function (idR, i) {
      var it = DC.items[idR];
      var clsLabel = it.tipo === 'benchmark' ? 'row-label is-bench' : 'row-label';
      var text = truncate(it.nome, 32);
      parts.push(
        '<text class="' + clsLabel + '" x="' + (labelLeft - 8) + '" y="' +
        (labelTop + i * cellSize + cellSize / 2 + 3) + '">' + escHtml(text) + '</text>');
    });

    // cells
    visible.forEach(function (idR, i) {
      visible.forEach(function (idC, j) {
        var x = labelLeft + j * cellSize;
        var y = labelTop  + i * cellSize;
        var r = (idR === idC) ? 1 : (corr[idR] && corr[idR][idC] != null ? corr[idR][idC] : null);
        // overlap em meses (null se payload antigo sem nobs)
        var nOv = null;
        if (idR === idC) nOv = null;
        else if (nobs && nobs[idR] && nobs[idR][idC] != null) nOv = nobs[idR][idC];
        var weak = (r != null && idR !== idC && nOv != null && nOv < minPts);
        var fill = corrColor(r);
        var rDisp = (r == null) ? '—' : ((r >= 0 ? '+' : '') + r.toFixed(2).replace('.', ','));
        parts.push(
          '<rect class="cell' + (weak ? ' is-weak' : '') + '" x="' + x + '" y="' + y +
          '" width="' + (cellSize - 1) + '" height="' + (cellSize - 1) +
          '" rx="2" fill="' + fill +
          (weak ? '" fill-opacity="0.55' : '') +
          '" data-i="' + idR + '" data-j="' + idC + '" data-v="' + rDisp +
          '" data-n="' + (nOv == null ? '' : nOv) +
          '" data-weak="' + (weak ? '1' : '0') + '" />');
      });
    });

    parts.push('</svg>');
    wrap.innerHTML = parts.join('');

    var svg = wrap.querySelector('svg');
    if (svg) {
      svg.addEventListener('mouseover', onCellHover);
      svg.addEventListener('mousemove', onMouseMove);
      svg.addEventListener('mouseout',  onMouseOut);
    }
  }

  function pickCellSize(n) {
    if (n <= 8)   return 48;
    if (n <= 14)  return 36;
    if (n <= 22)  return 28;
    if (n <= 35)  return 22;
    if (n <= 60)  return 16;
    return 12;
  }

  /* -------- tooltip ----------------------------- */
  function setupTooltip() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'cor-tooltip';
    document.body.appendChild(tooltipEl);
  }
  function onCellHover(e) {
    var t = e.target;
    if (!t || t.tagName !== 'rect' || !t.classList.contains('cell')) return;
    var i = +t.dataset.i, j = +t.dataset.j;
    var a = DC.items[i].nome;
    var b = DC.items[j].nome;
    var nStr  = t.dataset.n;
    var weak  = t.dataset.weak === '1';
    showTooltip(e.clientX, e.clientY, a, b, t.dataset.v, nStr, weak);
  }
  function onMouseMove(e) {
    if (tooltipEl && tooltipEl.classList.contains('is-visible')) {
      tooltipEl.style.left = e.clientX + 'px';
      tooltipEl.style.top  = e.clientY + 'px';
    }
  }
  function onMouseOut(e) {
    var to = e.relatedTarget;
    if (to && to.tagName === 'rect') return;
    if (tooltipEl) tooltipEl.classList.remove('is-visible');
  }
  function showTooltip(x, y, a, b, v, nStr, weak) {
    if (!tooltipEl) return;
    var nLine = '';
    if (nStr) {
      // reaproveita o estilo da .tt-pair (texto pequeno, cinza claro)
      nLine = '<div class="tt-pair" style="margin-top:4px;margin-bottom:0">n = '
            + escHtml(nStr) + (weak ? ' · amostra pequena' : '') + '</div>';
    }
    tooltipEl.innerHTML = '<div class="tt-pair">' + escHtml(a) + ' × ' + escHtml(b) +
                          '</div><div class="tt-value">' + escHtml(v) + '</div>' + nLine;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top  = y + 'px';
    tooltipEl.classList.add('is-visible');
  }

  /* -------- helpers ----------------------------- */
  function corrColor(r) {
    if (r == null || isNaN(r)) return '#FAFAFA';
    var a = Math.min(1, Math.abs(r));
    var alpha = (0.18 + 0.7 * a).toFixed(3);
    if (r >= 0) return 'rgba(0,113,227,' + alpha + ')';
    return 'rgba(255,59,48,' + alpha + ')';
  }
  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
})();
