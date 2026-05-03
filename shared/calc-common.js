/* ============================================================
   calc-common.js — Helpers compartilhados pelas 4 calculadoras
   Requer: window.CDI_DATA, window.IPCA_DATA, window.FERIADOS
           (carregados antes via shared/data/*.js + utils.js)
   ============================================================ */

/* ── Funções financeiras básicas ─────────────────────────── */
function taFn(idx, t, cdi, ipca) {
  if (idx === 'IPCA+') return (1 + t) * (1 + ipca) - 1;
  if (idx === '%CDI')  return t * cdi;
  if (idx === 'CDI+')  return (1 + t) * (1 + cdi) - 1;
  return t; // Pré
}
function tdFn(ta) { return Math.pow(1 + ta, 1/252) - 1; }
function fvFn(pv, d, n) { return pv * Math.pow(1 + d, n); }
function nperFn(d, pv, fv) {
  if (d <= 0 || pv <= 0 || fv <= 0) return 0;
  return Math.log(fv/pv) / Math.log(1 + d);
}
function rateFn(n, pv, fv) {
  if (n <= 0 || pv <= 0 || fv <= 0) return 0;
  return Math.pow(fv/pv, 1/n) - 1;
}

/* ── IR sobre renda fixa ────────────────────────────────── */
function aliqIR(diasCorridos) {
  if (diasCorridos <= 181) return 0.225;
  if (diasCorridos <  361) return 0.20;
  if (diasCorridos <  721) return 0.175;
  return 0.15;
}
function vliqFn(aplic, bruto, aliq, isento) {
  return isento ? bruto : aplic + (bruto - aplic) * (1 - aliq);
}

/* ── Acumular CDI/IPCA por período ──────────────────────── */
function acumCDI(d1, d2) {
  var acc = 1;
  var d = new Date(d1 + 'T12:00:00');
  var end = new Date(d2 + 'T12:00:00');
  while (d <= end) {
    var k = d.toISOString().slice(0, 10);
    var tx = (typeof cdiMap !== 'undefined') ? cdiMap.get(k) : null;
    if (tx != null) acc *= (1 + tx);
    d.setDate(d.getDate() + 1);
  }
  return acc - 1;
}
function acumIPCA(d1, d2) {
  var ini = new Date(d1 + 'T12:00:00'); ini.setDate(1);
  var fim = new Date(d2 + 'T12:00:00'); fim.setMonth(fim.getMonth() + 1); fim.setDate(0);
  var acc = 1, d = new Date(ini);
  while (d <= fim) {
    var k = d.toISOString().slice(0, 10);
    var tx = (typeof ipcaMap !== 'undefined') ? ipcaMap.get(k) : null;
    if (tx != null) acc *= (1 + tx);
    d.setMonth(d.getMonth() + 1);
  }
  return acc - 1;
}

/* ── Helpers DOM (set value, set color) ─────────────────── */
function sv(id, txt, cls) {
  var el = document.getElementById(id); if (!el) return;
  el.textContent = txt;
  if (cls) el.className = cls;
}
function sc(id, txt, col) {
  var el = document.getElementById(id); if (!el) return;
  el.textContent = txt;
  if (col) el.style.color = col;
}

/* ── Formatação live PT-BR (pontos de milhar) ───────────── */
function formatBRLive(rawValue, mode) {
  if (!rawValue) return '';
  var s = String(rawValue).replace(/[^0-9,]/g, '');
  if (mode === 'integer') {
    s = s.replace(/,/g, '');
    if (!s) return '';
    s = s.replace(/^0+(?=\d)/, '');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  var firstComma = s.indexOf(',');
  if (firstComma !== -1) {
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, '');
  }
  var partes = s.split(',');
  var inteira = partes[0].replace(/^0+(?=\d)/, '') || '';
  var decimal = partes.length > 1 ? partes[1].slice(0, 2) : null;
  if (inteira === '' && decimal !== null) inteira = '0';
  var intFmt = inteira ? inteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  if (decimal === null) return intFmt;
  return intFmt + ',' + decimal;
}
function attachLiveFormat(el, mode) {
  if (!el || el.dataset.liveFmt === '1') return;
  el.dataset.liveFmt = '1';
  el.addEventListener('input', function () {
    var old = el.value;
    var caret = el.selectionStart || 0;
    var keepBefore = 0;
    for (var i = 0; i < caret && i < old.length; i++) {
      var c = old.charAt(i);
      if (/[0-9]/.test(c) || (mode !== 'integer' && c === ',')) keepBefore++;
    }
    var formatted = formatBRLive(old, mode);
    if (formatted === old) return;
    el.value = formatted;
    var newPos = 0, consumed = 0;
    while (newPos < formatted.length && consumed < keepBefore) {
      var c2 = formatted.charAt(newPos);
      if (/[0-9]/.test(c2) || (mode !== 'integer' && c2 === ',')) consumed++;
      newPos++;
    }
    try { el.setSelectionRange(newPos, newPos); } catch (e) {}
  });
  if (mode !== 'integer') {
    el.addEventListener('blur', function () {
      var v = el.value;
      if (!v || v.indexOf(',') === -1) return;
      var partes = v.split(',');
      if (partes[1].length === 0) el.value = partes[0];
      else if (partes[1].length === 1) el.value = partes[0] + ',' + partes[1] + '0';
    });
  }
}

/* ── Aplicar formatação automática a todos os inputs ──── */
function instalarFormatacao(scope) {
  scope = scope || document;
  scope.querySelectorAll('input[inputmode="decimal"]').forEach(function (el) {
    attachLiveFormat(el, 'decimal');
  });
  scope.querySelectorAll('input[inputmode="numeric"]').forEach(function (el) {
    attachLiveFormat(el, 'integer');
  });
}

/* ── Limpar campos da página inteira ──────────────────── */
function limparCalculadora(recalc) {
  document.querySelectorAll('input[type="text"], input[type="date"], input[type="number"]').forEach(function (el) {
    el.value = '';
  });
  document.querySelectorAll('input[type="checkbox"]').forEach(function (el) {
    el.checked = false;
  });
  document.querySelectorAll('select').forEach(function (sel) {
    var defaultOpt = sel.querySelector('option[selected]');
    sel.selectedIndex = defaultOpt ? Array.prototype.indexOf.call(sel.options, defaultOpt) : 0;
  });
  if (typeof recalc === 'function') recalc();
}

/* ── Formatação de data ────────────────────────────────── */
function fDate(d) {
  return !d ? '—' : d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
