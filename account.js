(() => {
  const text = {
    zh: { signin:'登录', signup:'注册', close:'关闭', intro:'使用已有账号继续，首次登录将自动创建账户。', loading:'正在连接…', guest:'游客', user:'普通用户', admin:'管理员', google:'使用 Gmail / Google 登录', microsoft:'使用 Outlook / Microsoft 登录', logout:'退出登录', history:'历史记录', unavailable:'登录服务尚未配置或暂时不可用，你可以继续以游客身份浏览。', failed:'登录未完成，请重试。', privacy:'访问统计：记录 IP、时间、国家、浏览器信息及签名，仅管理员可查看。签名用于近似去重，可能因设置变化而改变；默认保留 90 天。', signing:'正在退出…' },
    en: { signin:'Sign in', signup:'Sign up', close:'Close', intro:'Continue with your existing account. Your first sign-in creates an account automatically.', loading:'Connecting…', guest:'Guest', user:'Member', admin:'Administrator', google:'Sign in with Gmail / Google', microsoft:'Sign in with Outlook / Microsoft', logout:'Sign out', history:'Visit history', unavailable:'Sign-in is not configured or temporarily unavailable. You can continue as a guest.', failed:'Sign-in was not completed. Please try again.', privacy:'Visit analytics record IP, time, country, browser details and a signature, visible only to administrators. Signatures provide approximate deduplication and may change with settings. Default retention: 90 days.', signing:'Signing out…' }
  };
  const header = document.querySelector('header');
  const actions = document.createElement('div');
  actions.className = 'header-actions';
  actions.append(document.querySelector('#language'));
  const bar = document.createElement('div');
  bar.className = 'account-bar';
  actions.append(bar);
  header.append(actions);
  const dialog = document.createElement('dialog');
  dialog.className = 'auth-dialog';
  dialog.setAttribute('aria-labelledby', 'auth-title');
  dialog.setAttribute('aria-describedby', 'auth-intro');
  document.body.append(dialog);
  const note = document.createElement('p');
  note.className = 'account-note';
  (document.querySelector('footer') || document.querySelector('main')).append(note);
  let user = null, providers = {}, unavailable = false, busy = false, loaded = false, mode = 'signin';
  const authError = new URLSearchParams(location.search).has('authError');
  if (authError) history.replaceState(null, '', location.pathname + location.hash);
  const lang = () => document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  const el = (tag, value, className) => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };
  function showAuth(nextMode) {
    mode = nextMode;
    renderDialog();
    dialog.showModal();
  }
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', () => bar.querySelector(`[data-auth="${mode}"]`)?.focus());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  function renderDialog() {
    const t = text[lang()];
    const hadFocus = dialog.contains(document.activeElement);
    const focusedProvider = hadFocus ? document.activeElement.dataset.provider : null;
    dialog.replaceChildren();
    const close = el('button', '×', 'auth-close');
    close.type = 'button'; close.setAttribute('aria-label', t.close);
    close.addEventListener('click', () => dialog.close());
    const title = el('h2', t[mode]); title.id = 'auth-title';
    const intro = el('p', t.intro, 'auth-intro'); intro.id = 'auth-intro';
    dialog.append(close, title, intro);
    for (const provider of ['google', 'microsoft']) {
      const button = el('button', '', 'auth-provider');
      button.type = 'button'; button.dataset.provider = provider;
      button.append(el('span', t[provider]));
      button.disabled = !loaded;
      button.addEventListener('click', () => {
        if (!providers[provider]) { unavailable = true; renderDialog(); }
        else location.assign(`/api/auth/${provider}`);
      });
      dialog.append(button);
    }
    if (!loaded || unavailable || authError) {
      const message = el('p', !loaded ? t.loading : unavailable ? t.unavailable : t.failed, 'account-message');
      message.setAttribute('role', 'status'); dialog.append(message);
    }
    const privacy = el('a', lang() === 'zh' ? '隐私说明' : 'Privacy notice', 'auth-privacy');
    privacy.href = './privacy.html'; dialog.append(privacy);
    if (hadFocus) (focusedProvider ? dialog.querySelector(`[data-provider="${focusedProvider}"]`) : close)?.focus();
  }
  function render() {
    const t = text[lang()];
    bar.replaceChildren();
    if (!user) {
      for (const action of ['signin', 'signup']) {
        const button = el('button', t[action], `auth-trigger auth-${action}`);
        button.type = 'button'; button.dataset.auth = action;
        button.setAttribute('aria-haspopup', 'dialog');
        button.addEventListener('click', () => showAuth(action));
        bar.append(button);
      }
    } else {
      const identity = el('span', '', 'account-identity');
      identity.append(el('span', t[user.role], 'account-role'));
      const email = el('span', user.email || user.name, 'account-email');
      email.title = user.email || user.name;
      identity.append(email); bar.append(identity);
      if (user.role === 'admin') { const link = el('a', t.history); link.href = './history.html'; bar.append(link); }
      const button = el('button', busy ? t.signing : t.logout);
      button.type = 'button'; button.disabled = busy;
      button.addEventListener('click', async () => {
        busy = true; render();
        try { await api('/api/logout', { method:'POST', body:'{}' }); location.reload(); }
        catch { busy = false; unavailable = true; render(); }
      });
      bar.append(button);
      if (unavailable) { const message = el('span', t.unavailable, 'account-message'); message.setAttribute('role', 'status'); bar.append(message); }
    }
    note.replaceChildren(document.createTextNode(t.privacy + ' '));
    const privacy = el('a', lang() === 'zh' ? '隐私说明' : 'Privacy notice'); privacy.href = './privacy.html'; note.append(privacy);
    renderDialog();
  }
  async function api(path, options = {}) {
    const response = await fetch(path, { credentials:'same-origin', cache:'no-store', ...options, headers:{ 'Content-Type':'application/json', ...options.headers } });
    if (!response.ok) { const error = new Error('Request failed'); error.status = response.status; throw error; }
    return response.json();
  }
  async function signature() {
    // No canvas, font enumeration or cross-site identifier; hash coarse browser properties locally.
    const info = JSON.stringify([navigator.userAgent, navigator.language, Intl.DateTimeFormat().resolvedOptions().timeZone, screen.width, screen.height, screen.colorDepth, navigator.maxTouchPoints]);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(info));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }
  render();
  window.addEventListener('nphunter-language', render);
  const ready = (async () => {
    if (!/^https?:$/.test(location.protocol)) { loaded = true; render(); return null; }
    try { const session = await api('/api/session'); user = session.user; providers = session.providers || {}; }
    catch { unavailable = true; }
    loaded = true; render();
    if (authError && !user) showAuth('signin');
    try { await api('/api/visits', { method:'POST', body:JSON.stringify({ signature:await signature(), eventId:crypto.randomUUID(), path:location.pathname }) }); }
    catch { /* Analytics must not block browsing or sign-in. */ }
    return user;
  })();
  window.NPHunterAccount = { ready, api };
})();
