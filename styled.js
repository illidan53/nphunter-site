(() => {
  // Interface style switch, plus the styled look's starfield and project carousel.
  const root = document.documentElement;
  const storageKey = 'nphunter-style';
  const themeColors = { styled: '#060818', normal: '#faf9f5' };
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const radios = [...document.querySelectorAll('input[name="site-style"]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const isStyled = () => root.dataset.style === 'styled';

  const space = document.querySelector('.space');
  const track = document.getElementById('project-track');
  const slides = [...track.querySelectorAll('.project')];
  const previous = document.querySelector('.carousel-prev');
  const next = document.querySelector('.carousel-next');
  const dockButtons = [...document.querySelectorAll('.project-dock ol button')];
  const status = document.getElementById('carousel-status');
  let centers = [], slideWidth = 1, active = 0, target = null, frame = 0, settleTimer = 0, announced = 0, starsReady = false;

  // Three layers of stars as SVG backgrounds. A fixed seed keeps the same sky on every visit.
  function buildStars() {
    if (starsReady) return;
    starsReady = true;
    let seed = 20260926;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const tints = ['#ffffff', '#ffffff', '#ffffff', '#dce6ff', '#c9dbff', '#ffe6cf', '#e8d9ff'];
    const layers = {
      far: { width:900, height:640, count:230, radius:[0.3, 0.85], alpha:[0.25, 0.7] },
      mid: { width:1100, height:760, count:80, radius:[0.6, 1.3], alpha:[0.45, 0.95] },
      near: { width:1400, height:900, count:18, radius:[1, 1.8], alpha:[0.75, 1], halo:true },
    };
    for (const [name, { width, height, count, radius, alpha, halo }] of Object.entries(layers)) {
      let shapes = halo ? '<defs><radialGradient id="h"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' : '';
      for (let i = 0; i < count; i++) {
        const x = (random() * width).toFixed(1), y = (random() * height).toFixed(1);
        const r = radius[0] + random() ** 2 * (radius[1] - radius[0]);
        const tint = tints[Math.floor(random() * tints.length)];
        if (halo) shapes += `<circle cx="${x}" cy="${y}" r="${(r * 5).toFixed(1)}" fill="url(#h)"/>`;
        shapes += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${tint}" opacity="${(alpha[0] + random() * (alpha[1] - alpha[0])).toFixed(2)}"/>`;
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes}</svg>`;
      const layer = space.querySelector(`.stars-${name}`);
      layer.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
      layer.style.backgroundSize = `${width}px ${height}px`;
    }
  }

  function measure() {
    slideWidth = slides[0].offsetWidth || 1;
    centers = slides.map(slide => slide.offsetLeft + slide.offsetWidth / 2);
  }
  const offsetFor = index => centers[index] - track.clientWidth / 2;

  function setActive(index) {
    active = index;
    dockButtons.forEach((button, i) => {
      if (i === index) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
    previous.setAttribute('aria-disabled', String(index === 0));
    next.setAttribute('aria-disabled', String(index === slides.length - 1));
  }

  // Each slide's --focus (1 when centered, 0 a slide away) and --shift (signed offset) follow the
  // scroll position, so swiping, the arrows and the dock all drive the same turn, scale and fade.
  function render() {
    frame = 0;
    if (!isStyled()) return;
    const middle = track.scrollLeft + track.clientWidth / 2;
    let nearest = 0;
    slides.forEach((slide, i) => {
      const offset = (centers[i] - middle) / slideWidth;
      slide.style.setProperty('--focus', Math.max(0, 1 - Math.abs(offset)).toFixed(3));
      slide.style.setProperty('--shift', Math.max(-1, Math.min(1, offset)).toFixed(3));
      if (Math.abs(offset) < Math.abs(centers[nearest] - middle) / slideWidth) nearest = i;
    });
    // The star layers drift a little as the row moves, for depth.
    const span = centers.at(-1) - centers[0];
    space.style.setProperty('--ratio', span > 0 ? Math.min(1, Math.max(0, (middle - centers[0]) / span)).toFixed(4) : 0);
    const current = target ?? nearest;
    if (current !== active) setActive(current);
  }

  function announce() {
    if (!isStyled() || active === announced) return;
    announced = active;
    const messages = (window.NPHunterLocales || {})[root.lang.startsWith('zh') ? 'zh' : 'en'] || {};
    const title = slides[active].querySelector('h3').textContent.trim();
    status.textContent = (messages['carousel.status'] || '{title} ({index}/{total})')
      .replace('{title}', title).replace('{index}', active + 1).replace('{total}', slides.length);
  }

  function settle() {
    clearTimeout(settleTimer);
    target = null;
    render();
    announce();
  }

  function onScroll() {
    if (!frame) frame = requestAnimationFrame(render);
    // Fallback for browsers without the scrollend event.
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 180);
  }

  function goTo(index, instant = false) {
    target = Math.max(0, Math.min(slides.length - 1, index));
    setActive(target);
    const left = offsetFor(target);
    if (instant || reducedMotion.matches) track.scrollLeft = left;
    else track.scrollTo({ left, behavior:'smooth' });
    // Settles even when the track is already in place and no scroll event follows.
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 800);
  }

  function step(direction) {
    const destination = (target ?? active) + direction;
    if (destination >= 0 && destination < slides.length) goTo(destination);
  }

  function applyStyle(style, remember) {
    root.dataset.style = style;
    radios.forEach(radio => { radio.checked = radio.value === style; });
    if (themeMeta) themeMeta.content = themeColors[style];
    if (remember) {
      try { localStorage.setItem(storageKey, style); } catch { /* Optional persistence. */ }
    }
    if (style === 'styled') {
      buildStars();
      measure();
      track.scrollLeft = offsetFor(active);
      render();
    }
  }

  radios.forEach(radio => radio.addEventListener('change', () => { if (radio.checked) applyStyle(radio.value, true); }));
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  dockButtons.forEach((button, index) => button.addEventListener('click', () => goTo(index)));
  track.addEventListener('scroll', onScroll, { passive:true });
  track.addEventListener('scrollend', settle);

  // A pointer click on a card that is not centered brings it to the center instead of opening it.
  // Keyboard activation (detail 0) always opens: focusing a card already centers it.
  track.addEventListener('click', event => {
    if (!isStyled() || event.detail === 0) return;
    const index = slides.indexOf(event.target.closest('.project'));
    if (index < 0 || index === (target ?? active)) return;
    event.preventDefault();
    event.stopPropagation();
    goTo(index);
  }, true);
  track.addEventListener('focusin', event => {
    if (!isStyled() || !event.target.matches(':focus-visible')) return;
    const index = slides.indexOf(event.target.closest('.project'));
    if (index >= 0 && index !== (target ?? active)) goTo(index);
  });
  // Left/right arrow keys move between projects unless a form control or dialog has them.
  document.addEventListener('keydown', event => {
    const direction = { ArrowLeft:-1, ArrowRight:1 }[event.key];
    if (!direction || !isStyled() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest('input, select, textarea, [contenteditable]') || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    step(direction);
  });

  // Keep the current card centered when the viewport (and so the slide width) changes.
  new ResizeObserver(() => {
    if (!isStyled()) return;
    measure();
    track.scrollLeft = offsetFor(target ?? active);
    render();
  }).observe(track);
  window.addEventListener('nphunter-language', () => { status.textContent = ''; announced = active; });

  setActive(0);
  applyStyle(isStyled() ? 'styled' : 'normal', false);
})();
