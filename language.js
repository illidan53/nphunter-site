(() => {
  const locales = window.NPHunterLocales;
  const selector = document.getElementById('language');
  const storageKey = 'nphunter-language';

  function applyLanguage(language) {
    const messages = locales[language];
    if (!messages) return;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = messages['page.title'];
    document.querySelector('meta[name="description"]').content = messages['page.description'];
    // A missing key (e.g. a stale cached locale file) keeps the current copy instead of blanking it.
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const text = messages[element.dataset.i18n];
      if (text !== undefined) element.textContent = text;
    });
    for (const attribute of ['aria-label', 'alt']) {
      document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(element => {
        const text = messages[element.getAttribute(`data-i18n-${attribute}`)];
        if (text !== undefined) element.setAttribute(attribute, text);
      });
    }
    selector.value = language;
    window.dispatchEvent(new Event('nphunter-language'));
  }

  let language = 'zh';
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'zh' || saved === 'en') language = saved;
  } catch { /* The selector still works when browser storage is unavailable. */ }
  applyLanguage(language);
  selector.addEventListener('change', () => {
    applyLanguage(selector.value);
    try { localStorage.setItem(storageKey, selector.value); } catch { /* Optional persistence. */ }
  });
})();
