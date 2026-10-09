const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lucianaib/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = __dirname;
const routes = ['home','meeting','butler','analyst','detective','refund','followup','escalation','cases','evidence','evidence-detail','timeline','tasks','drafts','report','settings','account','guide','brand'];
(async()=>{
 const browser = await chromium.launch({headless:true,channel:'msedge'});
 const result = {mode:'design-only',date:'2026-10-08',pages:[],interactions:[],errors:[]};
 for(const width of [1440,768,390]){
  const page = await browser.newPage({viewport:{width,height:width===390?844:1000},deviceScaleFactor:1});
  page.on('pageerror',err=>result.errors.push({width,error:err.message}));
  for(const route of routes){
   await page.goto('http://127.0.0.1:4173/design/index.html#'+route);
   await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete));
   const state = await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:Array.from(document.images).filter(i=>!i.naturalWidth).map(i=>i.src),buttons:document.querySelectorAll('button').length}));
   const screenshot = `screenshots/${route}-${width}.png`;
   await page.screenshot({path:path.join(root,screenshot),fullPage:true});
   result.pages.push({route,width,...state,screenshot});
   if(width===390&&['home','meeting','brand'].includes(route))await page.screenshot({path:path.join(root,`screenshots/${route}-390-viewport.png`)});
  }
  await page.goto('http://127.0.0.1:4173/design/index.html#meeting');
  await page.locator('#chat-input').fill('@');
  await page.locator('[data-mention="据理力争鸭"]').click();
  if(await page.locator('#chat-input').inputValue()!=='@据理力争鸭 ')throw Error('Mention selection failed');
  result.interactions.push({width,test:'mention selection',passed:true});
  await page.locator('[data-action="members"]').first().click();
  if(await page.locator('dialog .member-row').count()!==6)throw Error('Members missing');
  await page.screenshot({path:path.join(root,`screenshots/members-${width}.png`)});
  await page.locator('dialog [data-action="close"]').click();
  result.interactions.push({width,test:'six-member dialog',passed:true});
  await page.locator('#state-button').click();
  await page.screenshot({path:path.join(root,`screenshots/states-${width}.png`)});
  await page.keyboard.press('Escape');
  result.interactions.push({width,test:'state dialog and Escape',passed:true});
  await page.goto('http://127.0.0.1:4173/design/index.html#cases');
  await page.locator('[data-filter="archived"]').click();
  if(await page.locator('.case-card:visible').count()!==1)throw Error('Case filter failed');
  result.interactions.push({width,test:'case archive filter',passed:true});
  await page.goto('http://127.0.0.1:4173/design/index.html#evidence-detail');
  await page.locator('[data-action="confirm-facts"]').click();
  if(!(await page.locator('#toast').textContent()).includes('请先勾选'))throw Error('Evidence confirmation guard missing');
  await page.locator('#confirm-facts').check();
  await page.locator('[data-action="confirm-facts"]').click();
  if(!(await page.locator('#toast').textContent()).includes('确认效果'))throw Error('Evidence confirmation failed');
  result.interactions.push({width,test:'confirmation guard',passed:true});
  await page.goto('http://127.0.0.1:4173/design/index.html#timeline');
  await page.locator('[data-evidence="E003"]').click();
  if(!(await page.locator('dialog').textContent()).includes('E003 · 商品问题记录'))throw Error('E003 source routed incorrectly');
  await page.keyboard.press('Escape');
  result.interactions.push({width,test:'E003 source identity',passed:true});
  await page.goto('http://127.0.0.1:4173/design/index.html#account');
  await page.locator('[data-auth="register"]').click();
  if(await page.locator('#auth-submit').textContent()!=='创建账户'||await page.locator('#register-extra [type="password"]').count()!==1)throw Error('Registration state missing');
  await page.screenshot({path:path.join(root,`screenshots/register-${width}.png`),fullPage:true});
  await page.locator('[data-auth="login"]').click();
  if(await page.locator('#auth-submit').textContent()!=='登录')throw Error('Login state transition missing');
  result.interactions.push({width,test:'login-register state',passed:true});
  if(width===390){await page.goto('http://127.0.0.1:4173/design/index.html#meeting');await page.locator('[data-action="case-panel"]').click();await page.screenshot({path:path.join(root,'screenshots/mobile-case-panel-390.png')});await page.keyboard.press('Escape');result.interactions.push({width,test:'mobile case panel',passed:true});}
  await page.close();
 }
 await browser.close();
 result.passed=result.errors.length===0&&result.pages.every(p=>!p.overflow&&p.brokenImages.length===0);
 fs.writeFileSync(path.join(root,'verification.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:result.passed,pages:result.pages.length,interactions:result.interactions.length,issues:result.pages.filter(p=>p.overflow||p.brokenImages.length),errors:result.errors},null,2));
 if(!result.passed)process.exitCode=1;
})().catch(err=>{console.error(err);process.exitCode=1});
