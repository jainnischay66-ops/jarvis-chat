const puppeteer = require('/Users/nischayjain/Chatbot/jarvis/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = '/Users/nischayjain/Chatbot/jarvis/screenshots/layout-pass';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
  });

  const results = {
    errors: [],
    viewports: {}
  };

  try {
    const page = await browser.newPage();

    // Catch page errors
    page.on('pageerror', err => {
      console.error('Page error:', err.message);
      results.errors.push(err.message);
    });

    // 1. Check /jarvis-preview for Dev Overlay issues
    console.log('--- 1. Testing /jarvis-preview ---');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('http://localhost:3000/jarvis-preview', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const previewOverlay = await page.evaluate(() => {
      const portal = document.querySelector('nextjs-portal');
      if (!portal) return null;
      const root = portal.shadowRoot || portal;
      const issueNode = root.querySelector('[data-nextjs-dialog-header]') || root.querySelector('[data-issue-count]');
      return issueNode ? issueNode.textContent : null;
    });
    console.log('Preview Next.js Overlay Issues:', previewOverlay || 'CLEAN (0 Issues)');

    // 2. Clear conversations for Empty State testing
    console.log('--- 2. Setting up Empty State ---');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    // Clear indexedDB to ensure pure empty state
    await page.evaluate(() => {
      return new Promise((resolve) => {
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

    const viewports = [
      { name: '1280x600', width: 1280, height: 600, shortLaptop: true },
      { name: '1280x680', width: 1280, height: 680, targetLaptop: true },
      { name: '1440x800', width: 1440, height: 800, desktop: true },
      { name: '768x1024', width: 768, height: 1024, tablet: true },
      { name: '375x667', width: 375, height: 667, mobile: true }
    ];

    console.log('--- 3. Testing Empty State across viewports ---');
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));

      const emptyMetrics = await page.evaluate((vpInfo) => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        const hasHorizontalOverflow = docWidth > winWidth;

        // Check if greeting & suggestion chips are visible without scrolling
        const greeting = document.querySelector('h1');
        const greetingRect = greeting ? greeting.getBoundingClientRect() : null;

        const chips = Array.from(document.querySelectorAll('.suggestion-chip'));
        const chipRects = chips.map(c => c.getBoundingClientRect());
        const lowestChipBottom = chipRects.length > 0 ? Math.max(...chipRects.map(r => r.bottom)) : 0;

        // Check composer rect & column rect
        const composerWrap = document.querySelector('.composer-wrap');
        const composerRect = composerWrap ? composerWrap.getBoundingClientRect() : null;

        const scrollContainer = document.querySelector('.scroll');
        const scrollOverflows = scrollContainer ? scrollContainer.scrollHeight > scrollContainer.clientHeight : false;

        return {
          hasHorizontalOverflow,
          docWidth,
          winWidth,
          lowestChipBottom,
          viewportHeight: window.innerHeight,
          scrollOverflows,
          fitsWithoutScrolling: lowestChipBottom <= window.innerHeight,
          greetingVisible: greetingRect ? greetingRect.top >= 56 && greetingRect.bottom <= window.innerHeight : false,
          chipsCount: chips.length
        };
      }, vp);

      console.log(`Viewport ${vp.name} [Empty State]:`, emptyMetrics);
      results.viewports[`empty_${vp.name}`] = emptyMetrics;

      const screenshotPath = path.join(outDir, `empty-${vp.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`Saved screenshot: ${screenshotPath}`);
    }

    // 4. Inject 6+ messages into IndexedDB
    console.log('--- 4. Seeding Conversation with 6+ Messages ---');
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('jarvis-db');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('conversations', 'readwrite');
          const store = tx.objectStore('conversations');
          const testConv = {
            id: 'conv-stark-telemetry',
            title: 'DIAGNOSTIC TELEMETRY & TRAJECTORY COMPUTATION PROTOCOL',
            createdAt: Date.now() - 120000,
            updatedAt: Date.now(),
            messages: [
              {
                id: 'm1',
                role: 'user',
                content: 'Jarvis, initialize full diagnostic sequence on main power bus and thruster manifolds.',
                createdAt: Date.now() - 60000
              },
              {
                id: 'm2',
                role: 'assistant',
                content: 'Diagnostic sequence initiated, sir. Arc reactor core operating at 98.4% efficiency. Main bus voltage is stable across all twelve sectors with nominal load resistance.',
                createdAt: Date.now() - 50000
              },
              {
                id: 'm3',
                role: 'user',
                content: 'Check thermal distribution in the lower repulsor assembly before high-altitude burn.',
                createdAt: Date.now() - 40000
              },
              {
                id: 'm4',
                role: 'assistant',
                content: 'Lower repulsors are within safe tolerances: 342 Kelvin on the port emitter and 345 Kelvin on starboard. Composite alloy shows zero micro-fractures.',
                createdAt: Date.now() - 30000
              },
              {
                id: 'm5',
                role: 'user',
                content: 'Can we re-route auxiliary shunt power to shields if atmospheric re-entry exceeds threshold?',
                createdAt: Date.now() - 20000
              },
              {
                id: 'm6',
                role: 'assistant',
                content: 'Certainly, sir. I have prepared automated shunt protocol SHNT-889. Should plasma shear exceed 2,400 pascals, 40 megawatts will instantly re-route to forward deflector matrices.',
                createdAt: Date.now() - 10000
              }
            ]
          };
          store.put(testConv, 'conv-stark-telemetry');
          tx.oncomplete = () => {
            localStorage.setItem(
              'jarvis-preferences',
              JSON.stringify({
                lastConversationId: 'conv-stark-telemetry',
                sidebarOpen: true
              })
            );
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    console.log('--- 5. Testing Mid-Conversation (6+ Messages) across viewports ---');
    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1200));

      const chatMetrics = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        const hasHorizontalOverflow = docWidth > winWidth;

        // Check TopBar rect vs Scroll rect (no overlap)
        const topBar = document.querySelector('header');
        const scroll = document.querySelector('.scroll');
        const composerWrap = document.querySelector('.composer-wrap');
        const composer = document.querySelector('.composer-wrap .column > div');

        const topBarRect = topBar ? topBar.getBoundingClientRect() : null;
        const scrollRect = scroll ? scroll.getBoundingClientRect() : null;
        const composerWrapRect = composerWrap ? composerWrap.getBoundingClientRect() : null;

        const overlapsTopBarAndScroll = topBarRect && scrollRect ? scrollRect.top < topBarRect.bottom : false;
        const overlapsScrollAndComposer = scrollRect && composerWrapRect ? composerWrapRect.top < scrollRect.bottom - 1 : false;

        // Check composer horizontal centering relative to message column
        const messageCards = Array.from(document.querySelectorAll('.scroll .column'));
        const firstCol = messageCards[0] ? messageCards[0].getBoundingClientRect() : null;
        const composerCol = document.querySelector('.composer-wrap .column')?.getBoundingClientRect();

        const columnCenteredWithComposer = firstCol && composerCol
          ? Math.abs(firstCol.left - composerCol.left) < 2 && Math.abs(firstCol.right - composerCol.right) < 2
          : false;

        // Check sidebar ellipsis on active conversation row
        const sidebarRow = document.querySelector('aside .group span');
        const rowEllipsis = sidebarRow ? getComputedStyle(sidebarRow).textOverflow === 'ellipsis' : true;

        const messagesCount = document.querySelectorAll('.scroll .group').length;

        return {
          hasHorizontalOverflow,
          docWidth,
          winWidth,
          overlapsTopBarAndScroll,
          overlapsScrollAndComposer,
          columnCenteredWithComposer,
          rowEllipsis,
          topBarBottom: topBarRect?.bottom,
          scrollBoxTop: scrollRect?.top,
          scrollBoxBottom: scrollRect?.bottom,
          composerWrapTop: composerWrapRect?.top,
          messagesCount
        };
      });

      console.log(`Viewport ${vp.name} [Chat 6+ Messages]:`, chatMetrics);
      results.viewports[`chat_${vp.name}`] = chatMetrics;

      const screenshotPath = path.join(outDir, `chat-${vp.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`Saved screenshot: ${screenshotPath}`);
    }

    console.log('--- Verification Complete ---');
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
