const puppeteer = require('/Users/nischayjain/Chatbot/jarvis/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = '/Users/nischayjain/Chatbot/jarvis/screenshots/holographic';
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

    // 1. Capture Empty State (1280x680)
    console.log('--- 1. Capturing Empty State (1280x680) ---');
    await page.setViewport({ width: 1280, height: 680 });
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    // Clear conversations from IndexedDB to ensure pristine empty state
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
              resolve();
            };
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      });
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const emptyPath = path.join(outDir, '01-empty-state.png');
    await page.screenshot({ path: emptyPath });
    console.log(`Saved: ${emptyPath}`);

    // 2. Seed Conversation with a Long Assistant Reply (paragraphs, code block with line numbers)
    console.log('--- 2. Capturing Conversation with Long Assistant Reply ---');
    const longConv = {
      id: 'conv-long-telemetry',
      title: 'ORBITAL THERMAL ANALYSIS & SHIELD VECTOR PROTOCOL',
      createdAt: Date.now() - 100000,
      updatedAt: Date.now(),
      messages: [
        {
          id: 'u1',
          role: 'user',
          content: 'Jarvis, summarize the telemetry from the Mach-7 orbital reentry simulation and check deflector heat dissipation.',
          createdAt: Date.now() - 60000
        },
        {
          id: 'a1',
          role: 'assistant',
          content: `All telemetry sensors from the Mach-7 atmospheric entry vector have been analyzed, sir.

### Primary Diagnostic Summary
1. **Forward Kinetic Deflectors**: Surface dissipation reached a peak of **3,420°C** across the carbon-ceramic leading edge. Thermal shunts redirected 78% of plasma turbulence into auxiliary heatsinks.
2. **Repulsor Stabilizers**: Gimbal servos operated at **99.1% mechanical efficiency**. No oscillation or harmonic vibration detected.
3. **Flight Computer Latency**: Orbital recalculation cycle maintained an average internal latency of **12ms**.

Here is the automated thermal balancing subroutine deployed during plasma shear:

\`\`\`typescript
interface VectorTelemetry {
  machVelocity: number
  peakKelvin: number
  shuntThreshold: number
}

export function balanceThermalDissipation(t: VectorTelemetry): boolean {
  if (t.machVelocity > 6.5 && t.peakKelvin > 3200) {
    console.log('ENGAGING AUXILIARY CRYO-SHUNTS: SECTOR 4');
    return true;
  }
  return false;
}
\`\`\`

All secondary capacitors are recharged and ready for subsequent orbital burn at your command, sir.`,
          createdAt: Date.now() - 40000
        }
      ]
    };

    await page.evaluate((c) => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('jarvis-db');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('conversations', 'readwrite');
          const store = tx.objectStore('conversations');
          store.put(c, c.id);
          tx.oncomplete = () => {
            localStorage.setItem(
              'jarvis-preferences',
              JSON.stringify({
                lastConversationId: c.id,
                sidebarOpen: true
              })
            );
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, longConv);

    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const longReplyPath = path.join(outDir, '02-conversation-long-reply.png');
    await page.screenshot({ path: longReplyPath });
    console.log(`Saved: ${longReplyPath}`);

    // 3. Thinking State Screenshot
    console.log('--- 3. Capturing Thinking State ---');
    await page.setRequestInterception(true);
    let delayChat = true;
    page.on('request', req => {
      if (req.url().includes('/api/chat') && req.method() === 'POST' && delayChat) {
        // Keep in thinking state
        setTimeout(() => {
          req.respond({
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
            body: 'data: {"text":"Initiating "}\n\n'
          });
        }, 5000);
      } else {
        req.continue();
      }
    });

    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.type('Initiate orbital sweep on Stark Satellite 4B');
      await new Promise(r => setTimeout(r, 300));
    }

    const sendButton = await page.$('button[aria-label="Send message"]');
    if (sendButton) {
      await sendButton.click();
      // Wait for thinking state to activate
      await new Promise(r => setTimeout(r, 600));
    }

    const thinkingPath = path.join(outDir, '03-thinking-state.png');
    await page.screenshot({ path: thinkingPath });
    console.log(`Saved: ${thinkingPath}`);

    // 4. Mobile Width (375x667)
    console.log('--- 4. Capturing Mobile Width (375x667) ---');
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 375, height: 667 });
    await mobilePage.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    const mobilePath = path.join(outDir, '04-mobile-width.png');
    await mobilePage.screenshot({ path: mobilePath });
    console.log(`Saved: ${mobilePath}`);

    console.log('--- All Holographic Screenshots Captured Successfully! ---');
  } catch (err) {
    console.error('Screenshot capture failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
