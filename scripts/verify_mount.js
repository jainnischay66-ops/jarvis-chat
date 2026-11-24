const puppeteer = require('puppeteer-core');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function testMount() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#jarvis-persistent-stage');
  await page.waitForFunction(() => typeof window.__STAGE_CANVAS_MOUNTS__ === 'number');

  const m1 = await page.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('STANDBY mounts:', m1);

  // Transition to BOOTING
  await page.evaluate(() => window.__setPowerState('BOOTING'));
  await page.waitForSelector('div[role="region"][aria-label="JARVIS Cinematic Boot Film"]');
  const m2 = await page.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('BOOTING mounts:', m2);

  // Transition to ACTIVE
  await page.keyboard.press('Escape');
  await page.waitForSelector('.app');
  const m3 = await page.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('ACTIVE mounts:', m3);

  // Transition to SLEEPING
  await page.evaluate(() => window.__triggerPowerDown());
  await page.waitForSelector('div[role="alert"]');
  const m4 = await page.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('SLEEPING mounts:', m4);

  // Wait return to STANDBY
  await new Promise(r => setTimeout(r, 2200));
  await page.waitForSelector('h1');
  const m5 = await page.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('STANDBY returned mounts:', m5);

  const ok = m1 === 1 && m2 === 1 && m3 === 1 && m4 === 1 && m5 === 1;
  console.log('Mount count is 1 throughout full lifecycle:', ok ? 'PASS' : 'FAIL');

  await browser.close();
  if (!ok) process.exit(1);
}

testMount().catch(err => {
  console.error('MOUNT TEST ERROR:', err);
  process.exit(1);
});
