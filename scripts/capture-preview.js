const puppeteer = require('/Users/nischayjain/Chatbot/jarvis/node_modules/puppeteer-core');

(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });

    console.log('Navigating to http://localhost:3000/jarvis-preview ...');
    await page.goto('http://localhost:3000/jarvis-preview', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2500));

    const states = ['idle', 'listening', 'thinking', 'speaking'];
    const outDir = '/Users/nischayjain/Chatbot/jarvis/screenshots/jarvis-core';

    for (const state of states) {
      console.log(`Setting state: ${state} ...`);
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.trim().toLowerCase() === state) {
          await btn.click();
          break;
        }
      }
      await new Promise(r => setTimeout(r, 600));

      // Drag test the 3D canvas (pointer movement updates camera position)
      console.log(`Drag-testing 3D canvas for state: ${state} ...`);
      await page.mouse.move(600, 300);
      await page.mouse.down();
      await page.mouse.move(720, 240, { steps: 8 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 800));

      const path = `${outDir}/${state}.png`;
      await page.screenshot({ path });
      console.log(`Captured ${path}`);
    }

    await browser.close();
    console.log('All 4 states drag-tested and captured successfully!');
  } catch (err) {
    console.error('Error during capture:', err);
    process.exit(1);
  }
})();
