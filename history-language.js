(() => {
  const messages = {
    zh: { home:'← 返回首页', title:'访问历史', subtitle:'管理员专属 · 访问趋势与访客明细', checking:'正在验证访问权限…', denied:'此页面仅限管理员访问。请使用管理员账号登录。', unavailable:'暂时无法连接服务，请稍后刷新重试。', range:'趋势范围', refresh:'刷新趋势', views:'页面访问', unique:'去重访客', guests:'去重游客', trend:'每日趋势', legend:'蓝线：页面访问 · 绿线：去重访客 · 所有日期采用 UTC', daily:'查看每日数据', date:'日期（UTC）', records:'访客明细', query:'查询', recordNote:'按时间倒序；签名不等于真实身份，国家为网络位置估计。', time:'时间（UTC）', role:'身份', account:'账号', country:'国家', path:'页面', signature:'浏览器签名', browser:'浏览器 / 语言', more:'加载更多', limitations:'仅统计接入后的页面访问；屏蔽脚本的访问不会记录。游客按浏览器签名近似去重，登录用户按账号去重；登录前后可能计为两位访客。默认保留 90 天。', loading:'正在加载…', empty:'所选日期暂无访问记录。', error:'加载失败，请重试。', guest:'游客', user:'普通用户', admin:'管理员', complete:'已加载', unknown:'未知' },
    en: { home:'← Back to home', title:'Visit history', subtitle:'Administrators only · Trends and visitor records', checking:'Checking access…', denied:'This page is for administrators. Sign in with an administrator account.', unavailable:'Service unavailable. Please refresh to retry.', range:'Trend range', refresh:'Refresh trends', views:'Page views', unique:'Unique visitors', guests:'Unique guests', trend:'Daily trends', legend:'Blue: page views · Green: unique visitors · All dates in UTC', daily:'View daily data', date:'Date (UTC)', records:'Visitor records', query:'Search', recordNote:'Newest first. Signatures are approximate identifiers; countries estimate network location.', time:'Time (UTC)', role:'Role', account:'Account', country:'Country', path:'Page', signature:'Browser signature', browser:'Browser / language', more:'Load more', limitations:'Only visits after integration are recorded; blocked scripts are not tracked. Guests are approximately deduplicated by browser signature, members by account. A person may count twice across sign-in. Default retention: 90 days.', loading:'Loading…', empty:'No visits for the selected date.', error:'Could not load data. Please retry.', guest:'Guest', user:'Member', admin:'Administrator', complete:'Loaded', unknown:'Unknown' }
  };
  const selector = document.getElementById('language');
  let language = 'zh';
  try { if (localStorage.getItem('nphunter-language') === 'en') language = 'en'; } catch {}
  window.historyText = key => messages[language][key] || key;
  function apply() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = `${window.historyText('title')} · NPHunter`;
    selector.value = language;
    document.querySelectorAll('#range option').forEach(option => option.textContent = `${option.value} ${language === 'zh' ? '天' : 'days'}`);
    selector.setAttribute('aria-label', language === 'zh' ? '选择语言' : 'Choose language');
    document.querySelectorAll('[data-copy]').forEach(el => el.textContent = window.historyText(el.dataset.copy));
    document.querySelector('#trend-chart').setAttribute('aria-label', window.historyText('trend'));
    document.querySelector('.table-scroll[tabindex]').setAttribute('aria-label', window.historyText('records'));
    window.dispatchEvent(new Event('nphunter-language'));
  }
  selector.addEventListener('change', () => { language = selector.value; try { localStorage.setItem('nphunter-language', language); } catch {} apply(); });
  apply();
})();
