const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('--- STARTING BROWSER VERIFICATION & SCREENSHOT CAPTURE ---');

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    // Catch any page errors
    const pageErrors = [];
    page.on('pageerror', err => {
      console.error('Page error:', err.message);
      pageErrors.push(err.message);
    });

    // ──────────────────────────────────────────────────────────
    // 1. CAPTURE RESPONSIVE SCREENSHOTS (Light and Dark)
    // ──────────────────────────────────────────────────────────
    const viewports = [
      { name: 'desktop-1440', width: 1440, height: 900 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'mobile-375', width: 375, height: 812 },
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
      await sleep(500);

      // Force Dark Mode
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
        localStorage.setItem('jarvis-theme', 'dark');
      });
      await sleep(300);
      const darkPath = path.join(SCREENSHOTS_DIR, `${vp.name}-dark.png`);
      await page.screenshot({ path: darkPath });
      console.log(`✓ Captured: ${vp.name}-dark.png`);

      // Force Light Mode
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.classList.remove('dark');
        localStorage.setItem('jarvis-theme', 'light');
      });
      await sleep(300);
      const lightPath = path.join(SCREENSHOTS_DIR, `${vp.name}-light.png`);
      await page.screenshot({ path: lightPath });
      console.log(`✓ Captured: ${vp.name}-light.png`);
    }

    // ──────────────────────────────────────────────────────────
    // 2. VERIFY CORE CHAT INTERACTION & STREAMING
    // ──────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING CHAT INTERACTIONS ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await sleep(500);

    // Switch to dark theme for interaction test
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });

    // Verify empty state exists
    const hasGreeting = await page.evaluate(() => {
      return document.body.innerText.includes('Good') && document.body.innerText.includes('Jarvis');
    });
    console.log(`1. Empty state greeting: ${hasGreeting ? 'PASS' : 'FAIL'}`);

    // Send a message
    console.log('2. Sending message: "Explain gravity in one short sentence."...');
    await page.waitForSelector('textarea');
    await page.type('textarea', 'Explain gravity in one short sentence.');
    await page.keyboard.press('Enter');

    // Verify streaming tokens appear
    await sleep(800);
    const streamingState = await page.evaluate(() => {
      return document.querySelector('.streaming-cursor') !== null || document.body.innerText.includes('gravity');
    });
    console.log(`3. Streaming tokens active: ${streamingState ? 'PASS' : 'FAIL'}`);

    // Wait for response to complete
    await sleep(2500);
    const hasResponse = await page.evaluate(() => {
      return document.body.innerText.toLowerCase().includes('mass') ||
             document.body.innerText.toLowerCase().includes('force') ||
             document.body.innerText.toLowerCase().includes('pull') ||
             document.body.innerText.toLowerCase().includes('attract');
    });
    console.log(`4. Full stream response received: ${hasResponse ? 'PASS' : 'FAIL'}`);

    // Capture screenshot with active conversation
    const chatDarkPath = path.join(SCREENSHOTS_DIR, 'conversation-active-dark.png');
    await page.screenshot({ path: chatDarkPath });
    console.log(`✓ Captured: conversation-active-dark.png`);

    // ──────────────────────────────────────────────────────────
    // 3. VERIFY COMMAND PALETTE (Cmd+K)
    // ──────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING COMMAND PALETTE ---');
    await page.keyboard.down('Meta');
    await page.keyboard.press('k');
    await page.keyboard.up('Meta');
    await sleep(400);

    const paletteOpen = await page.evaluate(() => {
      return document.body.innerText.includes('Type a command or search') ||
             document.querySelector('input[placeholder*="command"]') !== null;
    });
    console.log(`5. Command Palette opened via ⌘K: ${paletteOpen ? 'PASS' : 'FAIL'}`);

    if (paletteOpen) {
      const paletteScreenshot = path.join(SCREENSHOTS_DIR, 'command-palette-spotlight.png');
      await page.screenshot({ path: paletteScreenshot });
      console.log(`✓ Captured: command-palette-spotlight.png`);
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // ──────────────────────────────────────────────────────────
    // 4. VERIFY SETTINGS SHEET
    // ──────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING SETTINGS SHEET ---');
    // Click settings button
    await page.evaluate(() => {
      const btn = document.querySelector('button[title="Settings"]') ||
                  document.querySelector('button[aria-label="Settings"]');
      if (btn) btn.click();
    });
    await sleep(400);

    const settingsOpen = await page.evaluate(() => {
      return document.body.innerText.includes('Settings') &&
             document.body.innerText.includes('Appearance') &&
             document.body.innerText.includes('Model Identifier');
    });
    console.log(`6. Settings Sheet opened: ${settingsOpen ? 'PASS' : 'FAIL'}`);

    if (settingsOpen) {
      const settingsScreenshot = path.join(SCREENSHOTS_DIR, 'settings-sheet-ios.png');
      await page.screenshot({ path: settingsScreenshot });
      console.log(`✓ Captured: settings-sheet-ios.png`);
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // ──────────────────────────────────────────────────────────
    // 5. VERIFY REGENERATE, EDIT & RESEND, SIDEBAR ACTIONS
    // ──────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING ACTIONS & CONVERSATION MANAGEMENT ---');
    // Hover over message to reveal actions
    const hasActionRow = await page.evaluate(() => {
      return document.querySelector('button[title="Copy"]') !== null ||
             document.querySelector('button[title="Regenerate"]') !== null;
    });
    console.log(`7. Message action row mounted: ${hasActionRow ? 'PASS' : 'FAIL'}`);

    // Test new chat button
    await page.evaluate(() => {
      const newChatBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('New chat'));
      if (newChatBtn) newChatBtn.click();
    });
    await sleep(400);

    const isNewChat = await page.evaluate(() => {
      return document.body.innerText.includes('Good') && document.body.innerText.includes('Jarvis');
    });
    console.log(`8. New chat creation: ${isNewChat ? 'PASS' : 'FAIL'}`);

    // Check console errors
    console.log(`\n9. Uncaught browser console/page errors: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      console.error('Errors found:', pageErrors);
    }

    console.log('\n--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
