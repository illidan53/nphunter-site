(() => {
  // Interface style switch and the styled look's seeded starfield.
  const root = document.documentElement;
  const storageKey = 'nphunter-style';
  const themeColors = { styled: '#060818', normal: '#faf9f5' };
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const radios = [...document.querySelectorAll('input[name="site-style"]')];
  const isStyled = () => root.dataset.style === 'styled';

  const space = document.querySelector('.space');
  let starsReady = false;

  // Three layers of stars as SVG backgrounds. A fixed seed keeps the same sky on every visit.
  function buildStars() {
    if (starsReady || !space) return;
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
      if (!layer) continue;
      layer.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
      layer.style.backgroundSize = `${width}px ${height}px`;
    }
  }

  function applyStyle(style, remember) {
    root.dataset.style = style;
    radios.forEach(radio => { radio.checked = radio.value === style; });
    if (themeMeta) themeMeta.content = themeColors[style];
    if (remember) {
      try { localStorage.setItem(storageKey, style); } catch { /* Optional persistence. */ }
    }
    if (style === 'styled') buildStars();
  }

  radios.forEach(radio => radio.addEventListener('change', () => { if (radio.checked) applyStyle(radio.value, true); }));
  applyStyle(isStyled() ? 'styled' : 'normal', false);
})();
