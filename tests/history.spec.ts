import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const host = 'http://nphunter.test';
async function mock(page, role: string | null) {
  let historyRequests = 0;
  await page.route(`${host}/**`, async route => {
    const url = new URL(route.request().url());
    if(url.pathname.startsWith('/api/')) {
      let body: any = {};
      if(url.pathname==='/api/session') body={user:role ? {role,email:'example@gmail.com',name:'Example'} : null,providers:{google:true,microsoft:true}};
      if(url.pathname.startsWith('/api/history')) {
        historyRequests++;
        if(role!=='admin')return route.fulfill({status:role?403:401,json:{error:'Forbidden'}});
        if(url.pathname.endsWith('/trend')) body={day:'2026-09-21',records:[{visitorId:'same',role:'guest'},{visitorId:'same',role:'guest'}],next:null};
        else body={records:[{time:'2026-09-21T12:00:00Z',role:'guest',email:null,ip:'203.0.113.1',country:'US',path:'/',signature:'a'.repeat(64),browser:'<script>alert(1)</script>',language:'zh-CN'}],cursor:null};
      }
      return route.fulfill({json:body});
    }
    const file = url.pathname==='/'?'index.html':url.pathname.slice(1);
    const contentType = file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/javascript';
    try { return route.fulfill({body:await readFile(`${process.cwd()}/${file}`),contentType}); } catch {return route.fulfill({status:404,body:''});}
  });
  return () => historyRequests;
}
test('guest login choices and provider navigation',async({page})=>{
  await mock(page,null);await page.goto(host);await expect(page.getByRole('button',{name:'登录',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'使用 Gmail / Google 登录'})).toBeHidden();
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('link',{name:'历史记录',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'使用 Gmail / Google 登录'}).click();await expect(page).toHaveURL(`${host}/api/auth/google`);
});
for (const role of [null,'user']) test(`history refuses ${role||'guest'} without fetching records`,async({page})=>{
  const count=await mock(page,role);await page.goto(`${host}/history.html`);await expect(page.locator('#access-status')).toContainText('仅限管理员');await expect(page.locator('#dashboard')).toBeHidden();expect(count()).toBe(0);
});
test('admin sees actual trends, deduplication and escaped details on mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mock(page,'admin');await page.goto(`${host}/history.html`);
  await expect(page.locator('#total-views')).toHaveText('2');await expect(page.locator('#total-unique')).toHaveText('1');await expect(page.locator('#visit-rows')).toContainText('203.0.113.1');await expect(page.locator('#visit-rows script')).toHaveCount(0);
  await page.locator('#language').selectOption('en');await expect(page.locator('h1')).toHaveText('Visit history');await expect(page.locator('#visit-rows')).toContainText('Guest');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/history-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/history-desktop.png',fullPage:true});
});
test('expired admin session hides records and totals on API rejection',async({page})=>{
  await mock(page,'admin');await page.route(`${host}/api/history**`,route=>route.fulfill({status:401,json:{error:'Expired'}}));
  await page.goto(`${host}/history.html`);await expect(page.locator('#access-status')).toContainText('仅限管理员');await expect(page.locator('#dashboard')).toBeHidden();
});

test('sign-up dialog supports keyboard dismissal, focus return and mobile layout',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mock(page,null);await page.goto(host);
  await expect(page.locator('header nav')).toHaveCount(0);
  await page.getByRole('button',{name:'注册',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('注册');
  await expect(page.getByRole('button',{name:'使用 Outlook / Microsoft 登录'})).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await page.locator('dialog.auth-dialog').evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.screenshot({path:'test-results/signin-mobile.png'});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button',{name:'注册',exact:true})).toBeFocused();
  await page.locator('#language').selectOption('en');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Sign in');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/header-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/header-desktop.png'});
  await page.getByRole('button',{name:'Sign up',exact:true}).click();
  await page.mouse.click(10,10);
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByRole('button',{name:'Sign in with Outlook / Microsoft'}).click();
  await expect(page).toHaveURL(`${host}/api/auth/microsoft`);
});
