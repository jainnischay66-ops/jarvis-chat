const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/Users/nischayjain/.gemini/antigravity/brain/c4c62c9c-de34-4c85-9cb9-9894ca7d33c8/layout_screenshots';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const RESOLUTIONS = [
  { name: '2560x1440', width: 2560, height: 1440, isMobile: false },
  { name: '1920x1080', width: 1920, height: 1080, isMobile: false },
  { name: '1440x900',  width: 1440, height: 900,  isMobile: false },
  { name: '1280x680',  width: 1280, height: 680,  isMobile: false },
  { name: '768x1024',  width: 768,  height: 1024, isMobile: true },
  { name: '375x667',   width: 375,  height: 667,  isMobile: true },
];

async function verifyAll() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=metal']
  });

  const results = {
    mountPersistence: null,
    layoutChecks: [],
    screenshots: []
  };

  // 1. Full Lifecycle Canvas Mount Persistence Test:
  // STANDBY -> BOOTING -> ACTIVE -> SLEEPING -> STANDBY
  console.log('=== Step 1: Testing Canvas Mount Persistence throughout Lifecycle ===');
  const cyclePage = await browser.newPage();
  await cyclePage.setViewport({ width: 1280, height: 680, deviceScaleFactor: 2 });
  await cyclePage.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

  // Wait for Stage and Canvas mount
  await cyclePage.waitForSelector('#jarvis-persistent-stage', { timeout: 10000 });
  await cyclePage.waitForFunction(() => typeof window.__STAGE_CANVAS_MOUNTS__ === 'number', { timeout: 10000 });

  const mountsStandby1 = await cyclePage.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('1. STANDBY initial mounts:', mountsStandby1);

  // Transition to BOOTING
  await cyclePage.evaluate(() => {
    if (typeof window.__setPowerState === 'function') {
      window.__setPowerState('BOOTING');
    }
  });

  await cyclePage.waitForSelector('div[role="region"][aria-label="JARVIS Cinematic Boot Film"]', { timeout: 6000 });
  const mountsBooting = await cyclePage.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('2. BOOTING mounts:', mountsBooting);

  // Transition to ACTIVE via Escape
  await cyclePage.keyboard.press('Escape');
  await cyclePage.waitForSelector('.app', { timeout: 6000 });
  await new Promise(r => setTimeout(r, 600));

  const mountsActive = await cyclePage.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('3. ACTIVE mounts:', mountsActive);

  // Trigger SLEEPING
  await cyclePage.evaluate(() => {
    if (typeof window.__triggerPowerDown === 'function') {
      window.__triggerPowerDown();
    }
  });
  await cyclePage.waitForSelector('div[role="alert"]', { timeout: 4000 });
  const mountsSleeping = await cyclePage.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('4. SLEEPING mounts:', mountsSleeping);

  // Auto-transition returns to STANDBY after ~1.8s
  await new Promise(r => setTimeout(r, 2200));
  await cyclePage.waitForSelector('h1', { timeout: 5000 });
  const mountsStandby2 = await cyclePage.evaluate(() => window.__STAGE_CANVAS_MOUNTS__);
  console.log('5. STANDBY returned mounts:', mountsStandby2);

  results.mountPersistence = {
    standby1: mountsStandby1,
    booting: mountsBooting,
    active: mountsActive,
    sleeping: mountsSleeping,
    standby2: mountsStandby2,
    allEqualOne: (
      mountsStandby1 === 1 &&
      mountsBooting === 1 &&
      mountsActive === 1 &&
      mountsSleeping === 1 &&
      mountsStandby2 === 1
    )
  };

  if (!results.mountPersistence.allEqualOne) {
    console.error('FAIL: Canvas mount count changed during lifecycle!', results.mountPersistence);
  } else {
    console.log('PASS: Canvas mount count stayed EXACTLY 1 throughout entire lifecycle!');
  }
  await cyclePage.close();

  // 2. Multi-Resolution Verification & Screenshots
  for (const res of RESOLUTIONS) {
    console.log(`\n=== Testing Resolution: ${res.name} (${res.width}x${res.height}) ===`);
    const page = await browser.newPage();
    await page.setViewport({
      width: res.width,
      height: res.height,
      deviceScaleFactor: 2,
      isMobile: res.isMobile
    });

    // --- A. STANDBY STATE ---
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#jarvis-persistent-stage', { timeout: 10000 });
    await page.waitForSelector('h1', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 300));

    const standbyPath = path.join(OUT_DIR, `${res.name}_STANDBY.png`);
    await page.screenshot({ path: standbyPath });
    results.screenshots.push(standbyPath);

    const standbyMetrics = await page.evaluate((vpWidth, vpHeight, isMob) => {
      const orbEl = document.querySelector('#hud-orb-canvas');
      const stageEl = document.querySelector('#jarvis-persistent-stage');
      const orbRect = orbEl ? orbEl.getBoundingClientRect() : null;

      const titleEl = document.querySelector('h1');
      const titleRect = titleEl ? titleEl.getBoundingClientRect() : null;

      const micBtn = document.querySelector('button[aria-label="Start listening for activation phrase"]');
      const micRect = micBtn ? micBtn.getBoundingClientRect() : null;

      const inputEl = document.querySelector('input[placeholder*="Wake up"]');
      const inputWrap = inputEl ? inputEl.closest('form') : null;
      const inputWrapRect = inputWrap ? inputWrap.getBoundingClientRect() : null;

      const bodyScrollWidth = document.body.scrollWidth;
      const bodyClientWidth = document.body.clientWidth;

      const statusChip = Array.from(document.querySelectorAll('span, div')).find(el => 
        el.textContent && (el.textContent.includes('STANDBY PROTOCOL ENGAGED') || el.textContent.includes('STANDBY'))
      );
      const statusRect = statusChip ? statusChip.getBoundingClientRect() : null;

      return {
        hasStage: !!stageEl,
        orbCenterDiffX: orbRect ? Math.abs((orbRect.left + orbRect.width / 2) - vpWidth / 2) : 999,
        titleCenterDiffX: titleRect ? Math.abs((titleRect.left + titleRect.width / 2) - vpWidth / 2) : 999,
        micCenterDiffX: micRect ? Math.abs((micRect.left + micRect.width / 2) - vpWidth / 2) : 999,
        inputWrapWidth: inputWrapRect ? inputWrapRect.width : 0,
        noHorizontalOverflow: bodyScrollWidth <= bodyClientWidth + 1,
        micSize: micRect ? Math.min(micRect.width, micRect.height) : 0,
        statusInViewport: statusRect ? statusRect.top >= 0 && statusRect.left >= 0 : false
      };
    }, res.width, res.height, res.isMobile);

    console.log(`[STANDBY] Metrics for ${res.name}:`, standbyMetrics);

    // --- B. BOOTING STATE ---
    await page.goto('http://localhost:3000?debug=boot', { waitUntil: 'networkidle2' });
    await page.waitForSelector('form input', { timeout: 10000 });
    await page.evaluate(() => {
      if (typeof window.__setPowerState === 'function') {
        window.__setPowerState('BOOTING');
      }
    });

    await page.waitForSelector('aside[aria-label="Boot Film Debug Scrubber"]', { timeout: 6000 });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside button'));
      const pBtn = btns.find(b => b.textContent && b.textContent.includes('PAUSE'));
      if (pBtn) pBtn.click();
    });

    // Act 4 Telemetry (t = 20.5s)
    await page.evaluate(() => {
      if (typeof window.__seekBoot === 'function') window.__seekBoot(20.5);
    });
    await new Promise(r => setTimeout(r, 200));

    const bootMetrics = await page.evaluate((vpWidth) => {
      const header = Array.from(document.querySelectorAll('div, span')).find(
        el => el.textContent && el.textContent.includes('SYSTEM BOOT INITIATED')
      );
      const skipBtn = document.querySelector('button[aria-label="Skip boot sequence"]');
      const skipRect = skipBtn ? skipBtn.getBoundingClientRect() : null;

      const telemetryCol = header ? header.closest('div.max-w-\\[520px\\]') || header.parentElement : null;
      const teleRect = telemetryCol ? telemetryCol.getBoundingClientRect() : null;

      return {
        headerNowrap: header ? header.scrollWidth <= header.clientWidth + 2 : false,
        telemetryMaxWidth: teleRect ? teleRect.width : 0,
        telemetryCenteredDiffX: teleRect ? Math.abs((teleRect.left + teleRect.width / 2) - vpWidth / 2) : 999,
        skipInViewport: skipRect ? skipRect.right <= vpWidth && skipRect.bottom >= 0 : false
      };
    }, res.width);

    console.log(`[BOOTING 20.5s] Metrics for ${res.name}:`, bootMetrics);
    const bootPath = path.join(OUT_DIR, `${res.name}_BOOTING_20.5s.png`);
    await page.screenshot({ path: bootPath });
    results.screenshots.push(bootPath);

    // Act 5 Wake caption (t = 21.8s)
    await page.evaluate(() => {
      if (typeof window.__seekBoot === 'function') window.__seekBoot(21.8);
    });
    await new Promise(r => setTimeout(r, 200));
    const bootCaptionPath = path.join(OUT_DIR, `${res.name}_BOOTING_21.8s.png`);
    await page.screenshot({ path: bootCaptionPath });
    results.screenshots.push(bootCaptionPath);

    // --- C. ACTIVE STATE ---
    await page.keyboard.press('Escape');
    await page.waitForSelector('.app', { timeout: 6000 });
    await new Promise(r => setTimeout(r, 700));

    const activeMetrics = await page.evaluate((vpWidth) => {
      const app = document.querySelector('.app');
      const column = document.querySelector('.column');
      const colRect = column ? column.getBoundingClientRect() : null;
      const stage = document.querySelector('#jarvis-persistent-stage');

      return {
        hasApp: !!app,
        hasStage: !!stage,
        chatColumnCenteredDiffX: colRect ? Math.abs((colRect.left + colRect.width / 2) - vpWidth / 2) : 999,
      };
    }, res.width);

    console.log(`[ACTIVE] Metrics for ${res.name}:`, activeMetrics);
    const activePath = path.join(OUT_DIR, `${res.name}_ACTIVE.png`);
    await page.screenshot({ path: activePath });
    results.screenshots.push(activePath);

    // --- D. SLEEPING STATE ---
    await page.evaluate(() => {
      if (typeof window.__triggerPowerDown === 'function') {
        window.__triggerPowerDown();
      }
    });
    await page.waitForSelector('div[role="alert"]', { timeout: 4000 });
    await new Promise(r => setTimeout(r, 200));

    const sleepPath = path.join(OUT_DIR, `${res.name}_SLEEPING.png`);
    await page.screenshot({ path: sleepPath });
    results.screenshots.push(sleepPath);

    results.layoutChecks.push({
      resolution: res.name,
      standby: standbyMetrics,
      boot: bootMetrics,
      active: activeMetrics
    });

    await page.close();
  }

  await browser.close();

  console.log('\n=======================================');
  console.log('      ALL VERIFICATIONS COMPLETE       ');
  console.log('=======================================');
  fs.writeFileSync(
    path.join(OUT_DIR, 'verification_report.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`Full report saved: ${path.join(OUT_DIR, 'verification_report.json')}`);
}

verifyAll().catch(err => {
  console.error('VERIFY ERROR:', err);
  process.exit(1);
});
