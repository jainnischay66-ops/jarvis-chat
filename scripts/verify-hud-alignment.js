const puppeteer = require('/Users/nischayjain/Chatbot/jarvis/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const VIEWPORTS = [
  { name: '1280x680', width: 1280, height: 680 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '375x667', width: 375, height: 667 },
];

function rectIntersects(r1, r2) {
  if (!r1 || !r2) return false;
  return !(
    r2.left >= r1.right ||
    r2.right <= r1.left ||
    r2.top >= r1.bottom ||
    r2.bottom <= r1.top
  );
}

(async () => {
  const outDir = '/Users/nischayjain/Chatbot/jarvis/screenshots/alignment';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
  });

  let totalErrors = 0;

  try {
    const page = await browser.newPage();

    for (const vp of VIEWPORTS) {
      console.log(`\n======================================================`);
      console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`======================================================`);
      await page.setViewport({ width: vp.width, height: vp.height });

      // 1. Empty State with ?debug=1
      await page.goto('http://localhost:3000/?debug=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));

      // Clear conversations to ensure empty state
      await page.evaluate(() => {
        return new Promise(resolve => {
          const req = indexedDB.open('jarvis-db');
          req.onsuccess = () => {
            const db = req.result;
            if (db.objectStoreNames.contains('conversations')) {
              const tx = db.transaction('conversations', 'readwrite');
              tx.objectStore('conversations').clear();
              tx.oncomplete = () => {
                localStorage.removeItem('jarvis-preferences');
                resolve(true);
              };
            } else {
              resolve(true);
            }
          };
          req.onerror = () => resolve(true);
        });
      });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 2000));

      // Check alignment and centers
      const measurements = await page.evaluate(() => {
        const main = document.querySelector('main.main');
        const rings = document.querySelector('#hud-rings-svg');
        const orb = document.querySelector('#hud-orb-canvas');
        const grid = document.querySelector('#hud-grid-floor');
        const telemLeft = document.querySelector('#hud-telemetry-left');
        const telemRight = document.querySelector('#hud-telemetry-right');
        const sidebar = document.querySelector('aside');
        const topbar = document.querySelector('header');
        const composer = document.querySelector('.composer-wrap');

        const getBox = el => el ? el.getBoundingClientRect().toJSON() : null;

        return {
          main: getBox(main),
          rings: getBox(rings),
          orb: getBox(orb),
          grid: getBox(grid),
          telemLeft: getBox(telemLeft),
          telemRight: getBox(telemRight),
          sidebar: getBox(sidebar),
          topbar: getBox(topbar),
          composer: getBox(composer),
        };
      });

      const { main, rings, orb, grid, telemLeft, telemRight, sidebar, topbar, composer } = measurements;

      if (!main) {
        console.error('FAIL: main.main element not found');
        totalErrors++;
        continue;
      }

      const mainCenter = { x: main.left + main.width / 2, y: main.top + main.height / 2 };
      console.log(`Main center: (${mainCenter.x.toFixed(2)}, ${mainCenter.y.toFixed(2)}) [size ${main.width}x${main.height}]`);

      // Verify concentricity
      if (rings) {
        const ringsCenter = { x: rings.left + rings.width / 2, y: rings.top + rings.height / 2 };
        const dx = Math.abs(mainCenter.x - ringsCenter.x);
        const dy = Math.abs(mainCenter.y - ringsCenter.y);
        console.log(`Rings center delta: dx=${dx.toFixed(2)}px, dy=${dy.toFixed(2)}px`);
        if (dx > 2 || dy > 2) {
          console.error(`FAIL: Rings center exceeds 2px threshold! (dx=${dx}, dy=${dy})`);
          totalErrors++;
        } else {
          console.log(`PASS: Rings center is within 2px of main center.`);
        }
      }

      if (orb) {
        const orbCenter = { x: orb.left + orb.width / 2, y: orb.top + orb.height / 2 };
        const dx = Math.abs(mainCenter.x - orbCenter.x);
        const dy = Math.abs(mainCenter.y - orbCenter.y);
        console.log(`Orb canvas center delta: dx=${dx.toFixed(2)}px, dy=${dy.toFixed(2)}px`);
        if (dx > 2 || dy > 2) {
          console.error(`FAIL: Orb canvas center exceeds 2px threshold! (dx=${dx}, dy=${dy})`);
          totalErrors++;
        } else {
          console.log(`PASS: Orb canvas center is within 2px of main center.`);
        }
      }

      if (grid) {
        const gridCenter = { x: grid.left + grid.width / 2, y: grid.top + grid.height / 2 };
        const dx = Math.abs(mainCenter.x - gridCenter.x);
        console.log(`Grid center horizontal delta: dx=${dx.toFixed(2)}px`);
        if (dx > 2) {
          console.error(`FAIL: Grid center horizontal delta exceeds 2px! (dx=${dx})`);
          totalErrors++;
        } else {
          console.log(`PASS: Grid center is horizontally aligned with main center.`);
        }
      }

      // Verify telemetry safe zone bounds (no intersection with sidebar, top bar, composer)
      if (telemLeft) {
        const hitSidebar = sidebar && sidebar.width > 0 && rectIntersects(telemLeft, sidebar);
        const hitTopbar = topbar && rectIntersects(telemLeft, topbar);
        const hitComposer = composer && rectIntersects(telemLeft, composer);
        if (hitSidebar || hitTopbar || hitComposer) {
          console.error(`FAIL: Left telemetry intersects forbidden element! (sidebar: ${hitSidebar}, topbar: ${hitTopbar}, composer: ${hitComposer})`);
          totalErrors++;
        } else {
          console.log(`PASS: Left telemetry does not intersect sidebar, topbar, or composer.`);
        }
      }

      if (telemRight) {
        const hitSidebar = sidebar && sidebar.width > 0 && rectIntersects(telemRight, sidebar);
        const hitTopbar = topbar && rectIntersects(telemRight, topbar);
        const hitComposer = composer && rectIntersects(telemRight, composer);
        if (hitSidebar || hitTopbar || hitComposer) {
          console.error(`FAIL: Right telemetry intersects forbidden element! (sidebar: ${hitSidebar}, topbar: ${hitTopbar}, composer: ${hitComposer})`);
          totalErrors++;
        } else {
          console.log(`PASS: Right telemetry does not intersect sidebar, topbar, or composer.`);
        }
      }

      // Capture Screenshot: Empty State
      const emptyFile = path.join(outDir, `${vp.name}-01-empty.png`);
      await page.screenshot({ path: emptyFile });
      console.log(`Saved screenshot: ${emptyFile}`);

      // 2. Chat State (Seed a message and capture)
      console.log(`--- Seeding conversation for chat state ---`);
      const testConv = {
        id: `conv-test-${vp.name}`,
        title: 'TACTICAL SATELLITE TELEMETRY',
        createdAt: Date.now() - 50000,
        updatedAt: Date.now(),
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'Jarvis, summarize deflector shield vectors for orbital reentry.',
            createdAt: Date.now() - 40000
          },
          {
            id: 'm2',
            role: 'assistant',
            content: 'Forward deflector shields are holding at 98.4% capacity. Thermal dispersal channels are nominal across all sectors.',
            createdAt: Date.now() - 30000
          }
        ]
      };

      await page.evaluate((conv) => {
        return new Promise(resolve => {
          const req = indexedDB.open('jarvis-db');
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('conversations', 'readwrite');
            const store = tx.objectStore('conversations');
            store.put(conv, conv.id);
            tx.oncomplete = () => {
              localStorage.setItem('jarvis-preferences', JSON.stringify({ lastConversationId: conv.id }));
              resolve(true);
            };
          };
          req.onerror = () => resolve(true);
        });
      }, testConv);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 2000));

      const chatFile = path.join(outDir, `${vp.name}-02-chat.png`);
      await page.screenshot({ path: chatFile });
      console.log(`Saved screenshot: ${chatFile}`);

      // 3. Thinking State (simulated active generation)
      await page.evaluate(() => {
        // Toggle thinking visual state on orb if possible
        const backdrop = document.querySelector('#hud-backdrop-root');
        if (backdrop) {
          const pulseCircle = backdrop.querySelector('.hud-pulse-ripple');
          if (pulseCircle) pulseCircle.setAttribute('stroke', '#F2B84B');
        }
      });
      await new Promise(r => setTimeout(r, 300));
      const thinkingFile = path.join(outDir, `${vp.name}-03-thinking.png`);
      await page.screenshot({ path: thinkingFile });
      console.log(`Saved screenshot: ${thinkingFile}`);
    }

    console.log(`\n======================================================`);
    console.log(`VERIFICATION COMPLETE: Total Errors = ${totalErrors}`);
    console.log(`======================================================`);
    if (totalErrors > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
