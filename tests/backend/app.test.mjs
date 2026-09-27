import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, viewer, validDay } from '../../backend/app.mjs';
const ADMINS = { google: 'owner@gmail.com', microsoft: 'owner@outlook.com' };
function setup(admins = ADMINS) {
  const data = new Map(); let clock = Date.parse('2026-09-21T12:00:00Z');
  const key = (pk,sk='META') => `${pk}|${sk}`;
  const store = {
    get: async (pk,sk) => data.get(key(pk,sk)),
    put: async (item,unique) => { const k=key(item.pk,item.sk); if(unique&&data.has(k))return false; data.set(k, structuredClone(item)); return true; },
    take: async pk => {const item=data.get(key(pk));data.delete(key(pk));return item;},
    page: async(day,cursor,limit=100) => {const all=[...data.values()].filter(r=>r.pk===`DAY#${day}`&&(!cursor||r.sk<cursor)).sort((a,b)=>b.sk.localeCompare(a.sk)); const items=all.slice(0,limit); return {items,cursor:all.length>limit?items.at(-1).sk:null};}
  };
  let user = { provider:'google', subject:'google-1', email:ADMINS.google, emailVerified:true, name:'Admin' };
  const oauth = {available:()=>({google:true,microsoft:true}),authorize:async(provider,flow)=>`https://provider.example/?state=${flow.state}`,exchange:async()=>structuredClone(user)};
  const app = createApp({store,oauth,origin:'https://nphunter.gg',originSecret:'test-origin-secret',admins,now:()=>clock});
  const request = (path,options={}) => app({ rawPath:path, requestContext:{http:{method:options.method||'GET'}}, headers:{'x-origin-verify':'test-origin-secret',origin:'https://nphunter.gg','content-type':'application/json','cloudfront-viewer-address':'203.0.113.1:3456','cloudfront-viewer-country':'US',...options.headers},cookies:options.cookies||[],queryStringParameters:options.q||{},body:options.body });
  const login = async() => { const start=await request(`/api/auth/${user.provider}`);const state=new URL(start.headers.location).searchParams.get('state');const cookie=start.cookies[0].split(';')[0];const result=await request(`/api/auth/${user.provider}/callback`,{q:{state,code:'code'},cookies:[cookie]});return {result,state,cookie,session:result.cookies[0]?.split(';')[0]}; };
  return {request,login,setUser:value=>user={...user,...value},data,advance:seconds=>clock+=seconds*1000};
}
test('anonymous, spoofed admin headers and member cannot read history',async()=>{
  const s=setup();assert.equal((await s.request('/api/history')).statusCode,401);
  assert.equal((await s.request('/api/history',{headers:{'x-role':'admin','x-email':ADMINS.google}})).statusCode,401);
  s.setUser({email:'member@gmail.com'});const {session}=await s.login();
  for(const path of ['/api/history','/api/history/trend'])assert.equal((await s.request(path,{cookies:[session]})).statusCode,403);
});
test('both configured administrators receive server-side roles; unverified email cannot',async()=>{
  for(const [provider,email] of Object.entries(ADMINS)){
    const s=setup();s.setUser({provider,email});const {session}=await s.login();const result=await s.request('/api/history',{cookies:[session]});assert.equal(result.statusCode,200);assert.match(result.headers['cache-control'],/no-store/);
  }
  const s=setup();s.setUser({emailVerified:false});const {session}=await s.login();assert.equal((await s.request('/api/history',{cookies:[session]})).statusCode,403);
});
test('no one is an administrator unless configured; configured mailboxes ignore case and spaces',async()=>{
  const none=setup({});const {session}=await none.login();assert.equal((await none.request('/api/history',{cookies:[session]})).statusCode,403);
  const padded=setup({google:' Owner@Gmail.com '});const login=await padded.login();assert.equal((await padded.request('/api/history',{cookies:[login.session]})).statusCode,200);
});
test('administrator email bootstrap binds immutable provider subject',async()=>{
  const s=setup();await s.login();s.setUser({subject:'different-subject'});const {session}=await s.login();assert.equal((await s.request('/api/history',{cookies:[session]})).statusCode,403);
});
test('OAuth callback requires browser binding and is single use',async()=>{
  const s=setup();const start=await s.request('/api/auth/google');const state=new URL(start.headers.location).searchParams.get('state');const cookie=start.cookies[0].split(';')[0];
  const bad=await s.request('/api/auth/google/callback',{q:{state,code:'code'},cookies:['__Host-nph-flow=forged']});assert.equal(bad.headers.location,'/?authError=invalid');
  const good=await s.request('/api/auth/google/callback',{q:{state,code:'code'},cookies:[cookie]});assert.equal(good.headers.location,'/');assert.match(good.cookies[0],/HttpOnly; Secure; SameSite=Lax/);
  const replay=await s.request('/api/auth/google/callback',{q:{state,code:'code'},cookies:[cookie]});assert.equal(replay.headers.location,'/?authError=invalid');
});
test('expired sessions and logout revoke API access; cross-site POST rejected',async()=>{
  const s=setup();let {session}=await s.login();assert.equal((await s.request('/api/logout',{method:'POST',cookies:[session],headers:{origin:'https://evil.example'}})).statusCode,403);
  await s.request('/api/logout',{method:'POST',cookies:[session]});assert.equal((await s.request('/api/history',{cookies:[session]})).statusCode,401);
  ({session}=await s.login());s.advance(86401);assert.equal((await s.request('/api/history',{cookies:[session]})).statusCode,401);
});
test('trusted edge required; visitor cannot submit IP, role or country',async()=>{
  const s=setup();assert.equal((await s.request('/api/session',{headers:{'x-origin-verify':'wrong'}})).statusCode,403);
  const body={signature:'a'.repeat(64),eventId:'a'.repeat(32),path:'/',ip:'1.1.1.1',country:'CN',role:'admin'};
  assert.equal((await s.request('/api/visits',{method:'POST',body:JSON.stringify(body)})).statusCode,202);
  const {session}=await s.login();const result=JSON.parse((await s.request('/api/history',{cookies:[session]})).body);
  assert.equal(result.records[0].ip,'203.0.113.1');assert.equal(result.records[0].country,'US');assert.equal(result.records[0].role,'guest');assert.ok(!('pk' in result.records[0]));
  for (const invalid of ['{', 'null', '[]']) assert.equal((await s.request('/api/visits',{method:'POST',body:invalid})).statusCode,400);
});
test('history pagination, range validation, expiry and trends are complete',async()=>{
  const s=setup();for(let i=0;i<105;i++){await s.request('/api/visits',{method:'POST',body:JSON.stringify({signature:'a'.repeat(64),eventId:String(i).padStart(32,'0'),path:'/'})});s.advance(1);}
  const {session}=await s.login();const cookies=[session];const first=JSON.parse((await s.request('/api/history',{cookies})).body);assert.equal(first.records.length,100);assert.ok(first.cursor);
  const last=JSON.parse((await s.request('/api/history',{cookies,q:{cursor:first.cursor}})).body);assert.equal(last.records.length,5);assert.equal(last.cursor,null);assert.ok(first.records[0].time>last.records[0].time);
  const trend=JSON.parse((await s.request('/api/history/trend',{cookies,q:{days:'7',day:'2026-09-21'}})).body);assert.equal(trend.records.length,105);assert.equal(new Set(trend.records.map(r=>r.visitorId)).size,1);
  for(const q of [{days:'1000'},{day:'2026-02-31'},{day:'2099-01-01'},{cursor:'invalid'}])assert.equal((await s.request('/api/history/trend',{cookies,q})).statusCode,400);
  s.advance(91*86400);const login=await s.login();assert.equal(JSON.parse((await s.request('/api/history',{cookies:[login.session],q:{day:'2026-09-21'}})).body).records.length,0);
});
test('date and trusted address parsers handle IPv6 and missing metadata',()=>{
  assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2026-09-21'),true);
  assert.equal(viewer({'cloudfront-viewer-address':'[2001:db8::1]:42'}).ip,'2001:db8::1');assert.deepEqual(viewer({}),{ip:'unknown',country:'unknown'});
});
