(async () => {
  const $ = id => document.getElementById(id);
  const t = key => window.historyText(key);
  const api = window.NPHunterAccount.api;
  let access = 'checking', trendStatus = '', recordStatus = '', daysData = null, rows = [], cursor = null, selectedDay = '', trendBusy = false, recordBusy = false;
  function status() { $('access-status').textContent = access ? t(access) : ''; $('trend-status').textContent = trendStatus ? t(trendStatus) : ''; $('records-status').textContent = recordStatus ? t(recordStatus) : ''; }
  function cell(row, text, className) { const td = document.createElement('td'); td.textContent = text; if (className) td.className = className; row.append(td); }
  function renderRows() {
    $('visit-rows').replaceChildren();
    for (const item of rows) {
      const row = document.createElement('tr');
      cell(row, item.time.replace('T',' ').replace('Z','')); cell(row, t(item.role)); cell(row, item.email || '—'); cell(row, item.ip);
      let country = t('unknown');
      try { if (item.country !== 'unknown') country = `${new Intl.DisplayNames([document.documentElement.lang], { type:'region' }).of(item.country)} (${item.country})`; } catch { country = item.country; }
      cell(row, country); cell(row, item.path); cell(row, item.signature, 'signature'); cell(row, `${item.browser}\n${item.language}`, 'browser'); $('visit-rows').append(row);
    }
  }
  function draw() {
    if (!daysData) return;
    const entries = [...daysData.entries()].sort(([a],[b]) => a.localeCompare(b));
    const all = new Set(), guests = new Set(); let views = 0;
    $('daily-rows').replaceChildren();
    for (const [day, data] of entries) { views += data.views; data.unique.forEach(id => all.add(id)); data.guests.forEach(id => guests.add(id)); const row = document.createElement('tr'); [day, data.views, data.unique.size, data.guests.size].forEach(value => cell(row, String(value))); $('daily-rows').append(row); }
    $('total-views').textContent = views.toLocaleString(); $('total-unique').textContent = all.size.toLocaleString(); $('total-guests').textContent = guests.size.toLocaleString();
    const svg = $('trend-chart'); svg.replaceChildren();
    const width = Math.max(300, svg.clientWidth || 960); svg.setAttribute('viewBox', `0 0 ${width} 260`);
    const add = (tag, attrs, text) => { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, value); if (text) node.textContent = text; svg.append(node); return node; };
    add('title', {}, t('trend')); add('desc', {}, t('legend'));
    const max = Math.max(1, ...entries.map(([,d]) => d.views));
    const x = i => 45 + i * (width - 75) / Math.max(1, entries.length - 1); const y = v => 220 - v / max * 190;
    for (let i=0; i<=4; i++) { const value = max*i/4; add('line',{x1:45,x2:width-30,y1:y(value),y2:y(value),stroke:'#dfdfd8'}); add('text',{x:36,y:y(value)+4,'text-anchor':'end',fill:'#626873','font-size':12},Number.isInteger(value) ? String(value) : value.toFixed(1)); }
    for (const [kind,color,dash] of [['views','#3059d9',''],['unique','#26634c','5 4']]) {
      add('polyline',{points:entries.map(([,d],i)=>`${x(i)},${y(kind==='views'?d.views:d.unique.size)}`).join(' '),fill:'none',stroke:color,'stroke-width':3,'stroke-dasharray':dash});
      entries.forEach(([day,d],i)=>{ const value = kind==='views'?d.views:d.unique.size; const dot = add('circle',{cx:x(i),cy:y(value),r:3,fill:color}); const title = document.createElementNS(svg.namespaceURI,'title'); title.textContent = `${day}: ${t(kind)} ${value}`; dot.append(title); });
    }
    [...new Set([0, Math.floor((entries.length-1)/2), entries.length-1])].forEach(i => { if(entries[i]) add('text',{x:x(i),y:246,'text-anchor':i===0?'start':i===entries.length-1?'end':'middle',fill:'#626873','font-size':12},entries[i][0]); });
  }
  function lock(error) {
    if ([401,403].includes(error.status)) { access = 'denied'; $('dashboard').hidden = true; rows = []; daysData = null; $('visit-rows').replaceChildren(); $('daily-rows').replaceChildren(); $('trend-chart').replaceChildren(); status(); return true; } return false;
  }
  async function loadTrend() {
    if (trendBusy) return;
    trendBusy = true; $('refresh').disabled = true; $('range').disabled = true; trendStatus = 'loading'; daysData = null;
    $('trend-chart').replaceChildren(); $('daily-rows').replaceChildren(); ['total-views','total-unique','total-guests'].forEach(id => $(id).textContent='—'); status();
    try {
      const data = new Map(); let next = {};
      do {
        const result = await api(`/api/history/trend?${new URLSearchParams({days:$('range').value,...next})}`);
        if (!data.has(result.day)) data.set(result.day,{views:0,unique:new Set(),guests:new Set()});
        const day = data.get(result.day); result.records.forEach(row => { day.views++; day.unique.add(row.visitorId); if(row.role==='guest') day.guests.add(row.visitorId); }); next = result.next;
      } while(next);
      daysData = data; trendStatus = 'complete'; draw();
    } catch(error) { lock(error); trendStatus = 'error'; }
    finally { trendBusy = false; $('refresh').disabled=false; $('range').disabled=false; status(); }
  }
  async function loadRows(more = false) {
    if (recordBusy || !$('record-day').reportValidity()) return;
    recordBusy = true; $('load-records').disabled = true; $('load-more').disabled = true; $('record-day').disabled = true;
    if (!more) { rows=[]; cursor=null; selectedDay=$('record-day').value; renderRows(); }
    recordStatus='loading'; status();
    try { const result = await api(`/api/history?${new URLSearchParams({ day:selectedDay,...(cursor?{cursor}:{}) })}`); rows.push(...result.records); cursor=result.cursor; recordStatus=rows.length?'complete':'empty'; renderRows(); }
    catch(error) { lock(error); recordStatus='error'; }
    finally { recordBusy=false; $('load-records').disabled=false; $('load-more').disabled=false; $('record-day').disabled=false; $('load-more').hidden=!cursor; status(); }
  }
  window.addEventListener('nphunter-language', () => { status(); renderRows(); draw(); });
  $('record-day').value = new Date().toISOString().slice(0,10);
  $('refresh').addEventListener('click',loadTrend); $('range').addEventListener('change',loadTrend); $('load-records').addEventListener('click',()=>loadRows()); $('load-more').addEventListener('click',()=>loadRows(true));
  new ResizeObserver(() => draw()).observe($('trend-chart'));
  status();
  const user = await window.NPHunterAccount.ready;
  if (user?.role !== 'admin') { access='denied'; status(); return; }
  // Protected API remains the authority even when the cached UI session says admin.
  access=''; $('dashboard').hidden=false; status();
  await Promise.all([loadTrend(), loadRows()]);
})();
