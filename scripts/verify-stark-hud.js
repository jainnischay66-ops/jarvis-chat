const puppeteer = require('/Users/nischayjain/Chatbot/jarvis/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

(async () => {
  const outDir = '/Users/nischayjain/Chatbot/jarvis/screenshots/stark-hud';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
  });

  try {
    const page = await browser.newPage();

    // 1. Check /jarvis-preview for any Dev Overlay Issue
    console.log('Checking /jarvis-preview for dev overlay errors...');
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewport({ width: 1200, height: 800 });
    await page.goto('http://localhost:3000/jarvis-preview', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Look for Next.js issue badge
    const devOverlayIssue = await page.evaluate(() => {
      const el = document.querySelector('nextjs-portal');
      if (!el) return null;
      return el.shadowRoot ? el.shadowRoot.innerHTML : el.innerHTML;
    });

    console.log('Dev overlay badge check:', devOverlayIssue ? 'FOUND' : 'CLEAN (0 Issues)');
    if (consoleErrors.length > 0) {
      console.log('Console errors on preview:', consoleErrors);
    }

    // 2. Test / empty state at 375px, 768px, 1440px
    const viewports = [
      { name: 'mobile-375', width: 375, height: 812 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'desktop-1440', width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
      console.log(`Testing / empty state at ${vp.width}x${vp.height}...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`Horizontal overflow at ${vp.width}px:`, overflow ? 'DETECTED' : 'NONE');

      const screenshotPath = path.join(outDir, `empty-state-${vp.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`Saved screenshot: ${screenshotPath}`);
    }

    // 3. Test mid-conversation at 375px, 768px, 1440px
    console.log('Testing conversation flow and orb-to-reactor transition...');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1200));

    // Type a message in composer
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.type('Analyze system diagnostics and orbital telemetry.');
      await new Promise(r => setTimeout(r, 200));

      // Click Send button
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), btn);
        if (ariaLabel === 'Send message') {
          await btn.click();
          break;
        }
      }

      // Wait for response or mock messages
      await new Promise(r => setTimeout(r, 3000));
    }

    for (const vp of viewports) {
      console.log(`Capturing mid-conversation at ${vp.width}x${vp.height}...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise(r => setTimeout(r, 600));

      // Check horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`Mid-conversation horizontal overflow at ${vp.width}px:`, overflow ? 'DETECTED' : 'NONE');

      const screenshotPath = path.join(outDir, `mid-conversation-${vp.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`Saved screenshot: ${screenshotPath}`);
    }

    // 4. Verify reduced motion
    console.log('Verifying reduced motion mode...');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));
    const reducedScreenshotPath = path.join(outDir, 'reduced-motion.png');
    await page.screenshot({ path: reducedScreenshotPath });
    console.log(`Saved screenshot: ${reducedScreenshotPath}`);

    // 5. Check text contrast and styles
    const stylesCheck = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const bg = body.getPropertyValue('--bg').trim();
      const text = body.getPropertyValue('--text').trim();
      const cyan = body.getPropertyValue('--cyan').trim();
      const gold = body.getPropertyValue('--gold').trim();
      return { bg, text, cyan, gold };
    });
    console.log('Computed Theme Tokens:', stylesCheck);

    console.log('All verification checks completed successfully!');
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
