/* ============================================================
   天梯挽歌 ELEVATOR ELEGY — interaction
   ============================================================ */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- boot ---------- */
  const boot = $('#boot');
  const start = () => {
    boot.classList.add('is-off');
    document.body.classList.remove('is-loading');
  };
  if (document.readyState === 'complete') setTimeout(start, reduced ? 0 : 700);
  else window.addEventListener('load', () => setTimeout(start, reduced ? 0 : 700));
  setTimeout(() => { if (!boot.classList.contains('is-off')) start(); }, 3000);

  /* ---------- header + progress ---------- */
  const bar = $('.bar');
  const prog = $('.progress i');
  const hero = $('#hero');

  const onScrollChrome = () => {
    const y = window.scrollY;
    bar.classList.toggle('is-solid', y > 40);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
  };
  window.addEventListener('scroll', onScrollChrome, { passive: true });
  onScrollChrome();

  /* ---------- reveal ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- nav highlight ---------- */
  const navLinks = $$('.bar__nav a');
  const sections = navLinks
    .map((a) => document.getElementById(a.dataset.nav))
    .filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = e.target.id;
        navLinks.forEach((a) => a.classList.toggle('is-here', a.dataset.nav === id));
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- mobile menu ---------- */
  const menuBtn = $('#menuBtn');
  const mnav = $('#mnav');
  if (menuBtn && mnav) {
    const setMenu = (open) => {
      mnav.classList.toggle('is-open', open);
      menuBtn.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? '关闭章节菜单' : '打开章节菜单');
      mnav.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('is-menu', open);
    };
    menuBtn.addEventListener('click', () => setMenu(!mnav.classList.contains('is-open')));
    // 捕获阶段先关菜单：否则 body 锁着滚动，后面的锚点跳转会失效
    mnav.addEventListener('click', (e) => {
      if (e.target.closest('a')) setMenu(false);
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mnav.classList.contains('is-open')) setMenu(false);
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 720 && mnav.classList.contains('is-open')) setMenu(false);
    });
  }

  /* ---------- the ladder: scroll-driven altimeter ---------- */
  const ladder = $('#ladder');
  const altNum = $('#altNum');
  const altUnit = $('#altUnit');
  const altName = $('#altName');
  const frames = $$('.ladder__frame');
  const stops = $$('.stop');
  const ticks = $$('.tick');

  const STATIONS = [
    { km: 0,       name: '赤道冻土层 · 废弃冷冻站' },
    { km: 0,       name: '赤道天梯基座 · 九根缆索' },
    { km: 400,     name: '中轨换乘环 · 标本库' },
    { km: 35786,   name: '同步轨道站 · 全景穹顶' },
    { km: 1500000, name: '拉格朗日点 L2 · 方舟' }
  ];

  const fmt = (km) => Math.round(km).toLocaleString('en-US');
  // log-space interpolation so the climb feels like acceleration
  const lerpAlt = (a, b, k) => {
    if (a === b) return a;
    const A = Math.log10(a + 1), B = Math.log10(b + 1);
    return Math.pow(10, A + (B - A) * k) - 1;
  };

  const LAST = STATIONS.length - 1;
  let curIdx = -1;
  let rafPending = false;
  let targetKm = 0, shownKm = 0, smoothRaf = 0;
  let lastNum = '', lastUnit = '';

  // the readout is written through a smoothing loop, so the digits tween
  // instead of snapping at every scroll event
  const renderAlt = () => {
    const unit = shownKm < 1 ? 'm' : 'km';
    const num = unit === 'm' ? '0' : fmt(shownKm);
    if (num !== lastNum) { altNum.textContent = num; lastNum = num; }
    if (unit !== lastUnit) {
      altUnit.textContent = 'ALTITUDE · ' + unit.toUpperCase();
      lastUnit = unit;
    }
  };

  const smoothTick = () => {
    const diff = targetKm - shownKm;
    const eps = Math.max(0.6, Math.abs(targetKm) * 0.0006);
    if (Math.abs(diff) <= eps) {
      shownKm = targetKm;
      renderAlt();
      smoothRaf = 0;
      return;
    }
    shownKm += diff * 0.16;
    renderAlt();
    smoothRaf = requestAnimationFrame(smoothTick);
  };

  const kickSmooth = () => {
    if (reduced) { shownKm = targetKm; renderAlt(); return; }
    if (!smoothRaf) smoothRaf = requestAnimationFrame(smoothTick);
  };

  const paintLadder = () => {
    rafPending = false;
    const rect = ladder.getBoundingClientRect();
    const total = Math.max(1, ladder.offsetHeight - window.innerHeight);
    const t = clamp(-rect.top / total, 0, 1) * 5; // 0 → 5 across the whole section

    // images: frame 0 sits on top, each frame dissolves into the next as t
    // crosses its boundary — opacity is driven by scroll, not by a timer
    frames.forEach((f, i) => {
      const opacity = i === LAST ? 1 : clamp(((i + 1.11) - t) / 0.22, 0, 1);
      if (f._op !== opacity) { f.style.opacity = opacity; f._op = opacity; }
    });

    const idx = clamp(Math.floor(t), 0, LAST);
    if (idx !== curIdx) {
      curIdx = idx;
      stops.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      ticks.forEach((k, i) => {
        k.classList.toggle('is-active', i === idx);
        k.setAttribute('aria-selected', i === idx ? 'true' : 'false');
      });
      altName.textContent = STATIONS[idx].name;
    }

    targetKm = lerpAlt(STATIONS[idx].km, STATIONS[Math.min(idx + 1, LAST)].km, clamp(t - idx, 0, 1));
    kickSmooth();
  };

  const requestLadder = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(paintLadder);
  };

  if (ladder) {
    frames.forEach((f, i) => { f.style.zIndex = String(5 - i); });
    window.addEventListener('scroll', requestLadder, { passive: true });
    window.addEventListener('resize', requestLadder);
    paintLadder();

    ticks.forEach((k, i) => {
      k.addEventListener('click', () => {
        const total = ladder.offsetHeight - window.innerHeight;
        const top = ladder.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + ((i + 0.5) / 5) * total, behavior: reduced ? 'auto' : 'smooth' });
      });
    });
  }

  /* ---------- locations rail: drag + keys ---------- */
  const rail = $('#rail');
  if (rail) {
    let down = false, startX = 0, startLeft = 0, moved = 0;

    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // native touch scrolling is better
      down = true; moved = 0;
      startX = e.clientX; startLeft = rail.scrollLeft;
      rail.classList.add('is-drag');
      rail.setPointerCapture(e.pointerId);
    });
    rail.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.abs(dx);
      rail.scrollLeft = startLeft - dx;
    });
    const end = (e) => {
      if (!down) return;
      down = false;
      rail.classList.remove('is-drag');
      if (rail.hasPointerCapture?.(e.pointerId)) rail.releasePointerCapture(e.pointerId);
    };
    rail.addEventListener('pointerup', end);
    rail.addEventListener('pointercancel', end);
    rail.addEventListener('pointerleave', end);
    rail.addEventListener('click', (e) => { if (moved > 8) e.preventDefault(); }, true);

    rail.addEventListener('keydown', (e) => {
      const step = Math.min(rail.clientWidth * 0.8, 700);
      if (e.key === 'ArrowRight') { rail.scrollBy({ left: step, behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowLeft')  { rail.scrollBy({ left: -step, behavior: 'smooth' }); e.preventDefault(); }
    });
  }

  /* ---------- prompt lightbox ---------- */
  const dlg = $('#lightbox');
  const dlgImg = dlg?.querySelector('img');
  $$('.pcard').forEach((card) => {
    card.addEventListener('click', () => {
      if (!dlg || !dlgImg) return;
      dlgImg.src = card.dataset.full;
      dlgImg.alt = card.querySelector('span')?.textContent || '提示词卡片';
      dlg.showModal();
    });
  });
  dlg?.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  /* ---------- film chapters ---------- */
  const video = $('#filmVideo');
  const chapterBtns = $$('.chapters button');
  if (video && chapterBtns.length) {
    chapterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        video.currentTime = Number(btn.dataset.t);
        video.play().catch(() => {});
        $('#film').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      });
    });

    const syncChapter = () => {
      let active = -1;
      chapterBtns.forEach((b, i) => {
        if (video.currentTime + 1 >= Number(b.dataset.t)) active = i;
      });
      chapterBtns.forEach((b, i) => b.classList.toggle('is-playing', i === active));
    };
    video.addEventListener('timeupdate', syncChapter, { passive: true });
    video.addEventListener('seeked', syncChapter);
    video.addEventListener('play', () => document.body.classList.add('is-playing-film'));
  }

  /* ---------- smooth anchors with fixed header ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = id === 'hero' ? hero : document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - (id === 'hero' ? 0 : 60);
      window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#' + id);
    });
  });
})();
