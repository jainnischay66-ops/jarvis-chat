const puppeteer = require('/Users/nischayjain/Chatbot/jarvis/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

(async () => {
  const outDir = '/Users/nischayjain/Chatbot/jarvis/screenshots/flow';
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
    await page.setViewport({ width: 1280, height: 680 });

    console.log('--- 1. Loading app ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const conv1 = {
      id: 'conv-arch-01',
      title: 'MARK-85 REPULSOR CALIBRATION',
      createdAt: Date.now() - 200000,
      updatedAt: Date.now() - 100000,
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Jarvis, check repulsor field calibration across all forward arrays.',
          createdAt: Date.now() - 150000
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'All repulsor nodes are calibrated within nominal tolerances, sir. Harmonic variance is less than 0.04% across the left and right gauntlet nodes.',
          createdAt: Date.now() - 140000
        }
      ]
    };

    const conv2 = {
      id: 'conv-arch-02',
      title: 'TACTICAL SATELLITE UPLINK',
      createdAt: Date.now() - 80000,
      updatedAt: Date.now() - 20000,
      messages: [
        {
          id: 'm3',
          role: 'user',
          content: 'Establish secure link to Stark Orbital array 4 and stream high-res thermal scans.',
          createdAt: Date.now() - 70000
        },
        {
          id: 'm4',
          role: 'assistant',
          content: 'Secure handshake established with Orbital Array 4 via encrypted quantum channel. Thermal telemetry feed initialized.',
          createdAt: Date.now() - 60000
        }
      ]
    };

    console.log('--- 2. Seeding IndexedDB ---');
    await page.evaluate((c1, c2) => {
      return new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open('jarvis-db');
          req.onsuccess = () => {
            const db = req.result;
            if (db.objectStoreNames.contains('conversations')) {
              const tx = db.transaction('conversations', 'readwrite');
              const store = tx.objectStore('conversations');
              store.clear();
              store.put(c1, c1.id);
              store.put(c2, c2.id);
              tx.oncomplete = () => {
                const prefs = { lastConversationId: c1.id };
                localStorage.setItem('jarvis-preferences', JSON.stringify(prefs));
                resolve(true);
              };
              tx.onerror = (e) => {
                console.error('tx error', e);
                resolve(false);
              };
            } else {
              resolve(false);
            }
          };
          req.onerror = () => resolve(false);
        } catch (err) {
          console.error('eval error', err);
          resolve(false);
        }
      });
    }, conv1, conv2);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    // (a) Capture conversation switch mid-pan
    console.log('--- (a) Capturing conversation switch mid-pan ---');
    // Trigger conversation select
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('button'));
      const target = items.find(b => b.textContent && b.textContent.includes('TACTICAL SATELLITE UPLINK'));
      if (target) target.click();
    });

    // Catch it right at mid-pan (~200ms into 450ms animation)
    await new Promise(r => setTimeout(r, 180));
    const panPath = path.join(outDir, 'flow-01-conversation-pan.png');
    await page.screenshot({ path: panPath });
    console.log(`Saved: ${panPath}`);

    // Wait for pan to settle
    await new Promise(r => setTimeout(r, 500));

    // (d) Composer focused showing glow ring (do this while on conversation view)
    console.log('--- (d) Capturing composer focused showing glow ring ---');
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.value = 'Jarvis, reroute auxiliary power to kinetic shields...';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 400));
    const composerFocusPath = path.join(outDir, 'flow-04-composer-focus.png');
    await page.screenshot({ path: composerFocusPath });
    console.log(`Saved: ${composerFocusPath}`);

    // (c) Active assistant message streaming with iridescent border
    console.log('--- (c) Capturing active assistant message streaming with iridescent border ---');
    await page.evaluate(() => {
      const panel = document.querySelector('.holo-assistant-panel');
      if (panel) {
        panel.classList.add('flow-border', 'flow-active');
      }
    });
    await new Promise(r => setTimeout(r, 400));
    const streamPath = path.join(outDir, 'flow-03-assistant-streaming.png');
    await page.screenshot({ path: streamPath });
    console.log(`Saved: ${streamPath}`);

    // (b) Empty to first message transition frame
    console.log('--- (b) Capturing empty-to-first message transition frame ---');
    // Clear storage and start fresh empty state
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

    // Click a suggestion chip to trigger transition to first message
    await page.evaluate(() => {
      const chip = document.querySelector('.suggestion-chip');
      if (chip) chip.click();
    });

    // Capture ~140ms into the transition
    await new Promise(r => setTimeout(r, 140));
    const emptyTransPath = path.join(outDir, 'flow-02-empty-to-first-message.png');
    await page.screenshot({ path: emptyTransPath });
    console.log(`Saved: ${emptyTransPath}`);

    console.log('--- All flow screenshots captured successfully ---');
  } catch (err) {
    console.error('Capture error:', err);
  } finally {
    await browser.close();
  }
})();
