const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/lucianaib/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:4173/design/character-board.html');
 await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));
 await page.locator('.board').screenshot({path:path.join(__dirname,'screenshots/character-family-v2.png')});
 await page.locator('#wordmark').screenshot({path:path.resolve(__dirname,'../public/assets/whyduck/logo/wordmark.png'),omitBackground:true});
 await page.goto('http://127.0.0.1:4173/design/index.html#home');
 await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));
 await page.locator('.sidebar .brandmark').screenshot({path:path.resolve(__dirname,'../public/assets/whyduck/logo/app-icon.png'),omitBackground:true});
 await browser.close();
 console.log('BRAND_EXPORT_OK');
})().catch(err=>{console.error(err);process.exitCode=1});
