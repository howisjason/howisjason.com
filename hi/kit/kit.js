/* =====================================================================
   SKY · kit.js: the one script behind every moving part of the kit.
   Plain JavaScript, no libraries. Link it once, after the stylesheets:
     <script src="kit/kit.js" defer></script>
   Optional, in the <head>, so nothing flickers before this file runs:
     <script>document.documentElement.classList.add('sky-js')</script>

   What it does, and why each piece is here:
   - PLAYS: every effect that plays once gets the class .is-on the moment it is seen
     (one IntersectionObserver, threshold 0: the first pixel on screen starts it, so a finished
     state is never shown and then snatched back). kit.css keys every effect on .is-on.
   - LOOPS: everything that keeps moving gets .is-off while out of sight, so it pauses and costs nothing.
   - Inside a reveal.js deck the slide decides instead of the scroll: when a slide becomes the
     current one (reveal's "ready" and "slidechanged" events, and the "present" class it sets),
     everything on it plays, and plays again each time the slide comes back. Fragments play as
     they are shown.
   - The few effects that need counting or building (count-ups, unit blocks, tally strokes,
     word by word, the step loop, the live calculator, rows that shrink to fit,
     the play button, chips made from a sentence) are small functions below.
   - The finished, readable state is always the page's own state: this file only ever starts an
     effect FROM somewhere TO that state. If this file never runs, the page is whole.
   - People who ask for less motion get the finished state at once: nothing counts, loops or builds motion.
   ===================================================================== */
(function () {
  'use strict';
  var doc = document, html = doc.documentElement;
  html.classList.add('sky-js');

  var still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hasIO = 'IntersectionObserver' in window;
  var all = function (sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); };
  var make = function (tag, cls) { var e = doc.createElement(tag); if (cls) e.className = cls; return e; };
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  // Every effect that plays once when seen. One list; kit.css keys each on .is-on.
  var PLAYS = [
    '[data-enter]', '[data-count]', '[data-count-from]',
    '.ring', '.dots', '.bars', '.compare', '.units', '.dotfill', '.timeline', '.walk', '.draw',
    '.clock', '.dial', '.snap', '.loop-turn', '.toggle', '.balance',
    '.swap', '.spotlight', '.halo', '.lift', '.veil-wipe', '.fall'
  ].join(',');

  // Everything that keeps moving. Paused (.is-off) while out of sight.
  var LOOPS = [
    '.ticker', '.orbit', '.radar', '.pulse-ring', '.spin-slow', '.float', '.pulse', '.sky-text.moving',
    '.ring.breathe', '.dots', '.disc', '.btn.gold', '.flow[data-loop]'
  ].join(',');

  // Children that take turns: each gets --k, its place in the line, so the CSS can delay it.
  var TURNS = [
    ['[data-stagger]', ':scope > *'], ['.dots', ':scope > i'], ['.units', ':scope > b'],
    ['.dotfill', ':scope > b.on, :scope > b.second'], ['.timeline', ':scope > li'], ['.walk', ':scope > li'],
    ['.bars', ':scope > .bar'], ['.compare', ':scope > *'], ['.draw', '[pathLength]']
  ];

  /* ---------- builders: run once, before anything plays ---------- */

  // word by word: wrap each word of the text in <span class="w">, keeping the spaces and any inner tags
  all('[data-enter="words"]').forEach(function (el) {
    var k = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 1) { walk(n); return; }
        if (n.nodeType !== 3 || !n.nodeValue.trim()) return;
        var frag = doc.createDocumentFragment();
        n.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
          var w = make('span', 'w'); w.textContent = part; w.style.setProperty('--k', k++); frag.appendChild(w);
        });
        node.replaceChild(frag, n);
      });
    })(el);
  });

  // blocks that pile on: .units data-n
  all('.units[data-n]').forEach(function (el) {
    if (el.children.length) return;
    for (var i = 0, n = +el.getAttribute('data-n') || 0; i < n; i++) el.appendChild(make('b'));
  });

  // a grid of units with some lit: .dotfill data-n data-on (data-mid: a second group in sky blue, so three groups never share a colour)
  all('.dotfill[data-n]').forEach(function (el) {
    if (el.children.length) return;
    var n = +el.getAttribute('data-n') || 0, on = +el.getAttribute('data-on') || 0, mid = +el.getAttribute('data-mid') || 0;
    for (var i = 0; i < n; i++) el.appendChild(make('b', i < on ? 'on' : i < on + mid ? 'second' : ''));
  });

  // tally strokes in fives: .tally data-n. Four upright strokes and a slash through each full five.
  all('.tally[data-n]').forEach(function (el) {
    if (el.querySelector('svg')) return;
    var n = +el.getAttribute('data-n') || 0, groups = Math.ceil(n / 5), d = '';
    var paths = [];
    for (var g = 0; g < groups; g++) {
      var x0 = g * 52 + 6, inGroup = Math.min(5, n - g * 5);
      for (var s = 0; s < Math.min(4, inGroup); s++) paths.push('M' + (x0 + s * 9) + ' 6V38');
      if (inGroup === 5) paths.push('M' + (x0 - 5) + ' 31L' + (x0 + 32) + ' 12');
    }
    paths.forEach(function (p) { d += '<path pathLength="1" d="' + p + '"/>'; });
    el.innerHTML = '<svg class="draw" viewBox="0 0 ' + (groups * 52) + ' 44" style="--gap:90ms;--dur:.3s" aria-hidden="true">' + d + '</svg>';
  });

  // a ticker: double its items so the strip can loop with no seam
  all('.ticker').forEach(function (t) {
    var track = t.querySelector('.ticker-track');
    if (!track || track.hasAttribute('data-doubled')) return;
    Array.prototype.slice.call(track.children).forEach(function (c) { var copy = c.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); track.appendChild(copy); });
    track.setAttribute('data-doubled', '');
    if (!still) t.classList.add('is-ready');
  });

  // chips from a sentence: data-chips="icon-a,icon-b" on "this, that, and the other."
  all('[data-chips]').forEach(function (el) {
    var icons = el.getAttribute('data-chips').split(',');
    var small = /^(a|an|the|and|but|or|for|nor|to|of|in|on|at|by|as)$/i;
    var row = make('div', 'chips'); row.setAttribute('aria-hidden', 'true');
    el.textContent.trim().replace(/\.$/, '').split(/,\s*(?:and\s+|or\s+)?/).forEach(function (t, i) {
      var c = make('span', 'chip'), ico = make('i', 'ico ico-' + (icons[i] || 'sparkles').trim());
      c.appendChild(ico);
      c.appendChild(doc.createTextNode(t.split(' ').map(function (w, k) { return k && small.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1); }).join(' ')));
      row.appendChild(c);
    });
    el.classList.add('sky-quiet'); el.after(row);
  });

  // number every child that takes turns
  TURNS.forEach(function (t) {
    all(t[0]).forEach(function (el) {
      all(t[1], el).forEach(function (c, i) { if (!c.style.getPropertyValue('--k')) c.style.setProperty('--k', i); });
    });
  });

  /* ---------- counting: data-count (up from 0) and data-count-from="N" (down, or up, from N) ---------- */
  function countOf(el) {
    if (el._sky) return el._sky;
    var m = el.textContent.match(/^([^\d]*?)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/);
    if (!m) return null;
    var raw = m[2];
    el._sky = { pre: m[1], n: parseFloat(raw.replace(/,/g, '')), dec: (raw.split('.')[1] || '').length, comma: raw.indexOf(',') > -1, post: m[3],
      from: el.hasAttribute('data-count-from') ? parseFloat(el.getAttribute('data-count-from')) : 0 };
    return el._sky;
  }
  function show(el, c, v) {
    var s = c.comma ? v.toLocaleString('en-US', { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec }) : v.toFixed(c.dec);
    el.textContent = c.pre + s + c.post;
  }
  function count(el) {
    var c = countOf(el); if (!c || still) return;
    var t0 = performance.now(), dur = (parseFloat(el.getAttribute('data-count-time')) || 2) * 1000, id = el._run = (el._run || 0) + 1;
    show(el, c, c.from);
    requestAnimationFrame(function step(now) {
      if (el._run !== id) return;
      var k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      show(el, c, c.from + (c.n - c.from) * e);
      if (k < 1) requestAnimationFrame(step);
    });
  }
  // hold each counting number's finished width, so nothing beside it shifts while it counts
  var counts = all('[data-count],[data-count-from]');
  counts.forEach(countOf);
  (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(function () {
    counts.forEach(function (el) {
      if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
      el.style.minWidth = Math.ceil(el.getBoundingClientRect().width) + 'px';
    });
  });

  /* ---------- play, stop, replay ---------- */
  function playersIn(scope) {
    var list = all(PLAYS, scope);
    if (scope.matches && scope.matches(PLAYS)) list.unshift(scope);
    return list;
  }
  function on(el) {
    el.classList.add('is-on');
    if (el.hasAttribute('data-count') || el.hasAttribute('data-count-from')) count(el);
  }
  // Take .is-on off, let the browser see it gone (one reflow for the whole batch), put it back:
  // every CSS animation in the batch starts again from its beginning.
  function play(scope, skip) {
    var list = playersIn(scope).filter(function (el) { return !skip || !skip(el); });
    list.forEach(function (el) { el.classList.remove('is-on'); });
    void html.offsetWidth;
    list.forEach(on);
  }
  // Stopping puts a half-counted number back to its finished value, so nothing is ever left mid-way.
  function stop(scope) {
    playersIn(scope).forEach(function (el) {
      el.classList.remove('is-on');
      if (el._run) { el._run = 0; show(el, el._sky, el._sky.n); }
    });
  }

  /* ---------- the reveal.js deck: the current slide plays ---------- */
  var deck = doc.querySelector('.reveal .slides');
  var current = null;
  var inDeck = function (el) { return deck && deck.contains(el); };
  var hiddenFragment = function (el) { var f = el.closest('.fragment'); return f && !f.classList.contains('visible'); };
  function currentSlide() {
    var p = all('section.present', deck);
    return p.filter(function (s) { return !s.querySelector('section.present'); })[0] || null;
  }
  function sync() {
    var s = currentSlide();
    if (s === current) return;
    if (current) {
      stop(current);
      all(LOOPS, current).forEach(function (l) { l.classList.add('is-off'); });
    }
    current = s;
    all(LOOPS, deck).forEach(function (l) { l.classList.toggle('is-off', !s || !s.contains(l)); });
    if (s) play(s, hiddenFragment);
  }
  if (deck) {
    var queued = false;
    var later = function () { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; sync(); }); };
    ['ready', 'slidechanged'].forEach(function (t) { doc.addEventListener(t, later); });
    if (window.Reveal && typeof Reveal.on === 'function') { try { Reveal.on('ready', later); Reveal.on('slidechanged', later); } catch (e) { /* older reveal */ } }
    // The "present" class is the truth reveal writes; watching it also covers a deck whose events we miss.
    // Fragments: a fragment that becomes visible plays; one that is hidden again stops.
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        var t = r.target, was = (r.oldValue || '').split(/\s+/);
        if (t.classList.contains('fragment')) {
          var now = t.classList.contains('visible'), before = was.indexOf('visible') > -1;
          if (now && !before) play(t); else if (!now && before) stop(t);
        }
      });
      later();
    }).observe(deck, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    later();
  }

  /* ---------- on a page: play when seen, pause loops while unseen ---------- */
  var pagePlayers = all(PLAYS).filter(function (el) { return !inDeck(el); });
  if (still || !hasIO) {
    pagePlayers.forEach(on);
  } else {
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { seen.unobserve(e.target); on(e.target); } });
    }, { threshold: 0 });
    pagePlayers.forEach(function (el) { seen.observe(el); });

    var looking = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('is-off', !e.isIntersecting); });
    }, { threshold: 0 });
    all(LOOPS).filter(function (el) { return !inDeck(el); }).forEach(function (el) { looking.observe(el); });
  }

  /* ---------- the step loop: .flow data-loop ---------- */
  if (!still) all('.flow[data-loop]').forEach(function (flow) {
    var steps = all(':scope > .step', flow);
    if (steps.length < 2) return;
    var ms = parseInt(flow.getAttribute('data-loop'), 10) || 1800, i = 0, rest = 0;
    function light(n) {
      steps.forEach(function (s, k) { s.classList.toggle('now', k === n); s.classList.toggle('lit', k <= n); });
      play(steps[n]);   // anything inside the step (words arriving, a count) plays as it lights
    }
    flow.classList.add('is-looping');
    light(0);
    setInterval(function () {
      if (flow.classList.contains('is-off') || doc.hidden) return;
      if (i < steps.length - 1) light(++i);
      else if (++rest > 2) { rest = 0; i = 0; light(0); }   // the last step holds for a moment, then it starts again
    }, ms);
  });

  /* ---------- the live calculator: <output data-calc="{loaves} * {days}" data-format="money"> ---------- */
  all('[data-calc]').forEach(function (out) {
    var formula = out.getAttribute('data-calc'), fmt = out.getAttribute('data-format') || 'number';
    var ids = (formula.match(/\{([^}]+)\}/g) || []).map(function (x) { return x.slice(1, -1); });
    var inputs = ids.map(function (id) { return doc.getElementById(id); });
    function run() {
      var expr = formula.replace(/\{([^}]+)\}/g, function (_, id) { var v = parseFloat((doc.getElementById(id) || {}).value); return isFinite(v) ? '(' + v + ')' : '0'; });
      if (!/^[\d\s+\-*/().]*$/.test(expr)) return;   // only numbers and + - * / ( ) ever run
      var n; try { n = Function('"use strict";return (' + expr + ')')(); } catch (e) { return; }
      if (!isFinite(n)) n = 0;
      var text = fmt === 'money' ? '$' + Math.round(n).toLocaleString('en-US') : fmt === 'percent' ? Math.round(n) + '%' : Math.round(n).toLocaleString('en-US');
      if (out.textContent === text) return;
      out.textContent = text;
      if (!still) { out.classList.remove('is-bump'); void out.offsetWidth; out.classList.add('is-bump'); }
    }
    inputs.forEach(function (i) { if (i) i.addEventListener('input', run); });
    run();
  });

  /* ---------- rows that shrink to fit: data-fit (the live page's hero rows) ---------- */
  var fits = all('[data-fit]');
  function fit() {
    fits.forEach(function (r) {
      r.classList.remove('stacked'); r.style.zoom = '';
      var p = r.parentElement, cs = getComputedStyle(p);
      var room = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), w = r.scrollWidth;
      if (w <= room) return;
      // shrink a little to stay on one line; if it would have to shrink below 70% (too small to read), stack instead
      if (room / w < .7) r.classList.add('stacked'); else r.style.zoom = (room / w).toFixed(3);
    });
  }
  if (fits.length) {
    fit();
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(fit); fits.forEach(function (r) { ro.observe(r.parentElement); }); }
    else addEventListener('resize', fit);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit);
  }

  /* ---------- the play button over a video: .shot holding a video and button.play ---------- */
  all('.shot').forEach(function (s) {
    var v = s.querySelector('video'), b = s.querySelector('.play');
    if (!v || !b) return;
    v.controls = false;
    b.addEventListener('click', function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); });
    v.addEventListener('play', function () { b.hidden = true; v.controls = true; });
  });

  /* ---------- Play Again buttons on kit pages: data-replay (plays everything in its .tile again) ---------- */
  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-replay]');
    if (!b) return;
    var scope = b.closest(b.getAttribute('data-replay') || '.tile');
    if (scope) play(scope);
  });

  window.Sky = { play: play, stop: stop };
})();
