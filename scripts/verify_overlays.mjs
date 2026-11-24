import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const MODE_LABEL = process.env.MODE_LABEL || 'dev'
const SCREENSHOT_DIR = `/Users/nischayjain/.gemini/antigravity/brain/c4c62c9c-de34-4c85-9cb9-9894ca7d33c8/overlay_screenshots/${MODE_LABEL}`

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x680', width: 1280, height: 680 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '375x667', width: 375, height: 667 },
]

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`)
  }
}

async function enterActiveMode(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' })
  await page.waitForSelector('input', { timeout: 10000 })
  await page.type('input', 'wake up jarvis')
  await page.keyboard.press('Enter')

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500))
    const active = await page.evaluate(() => !!document.querySelector('button[title*="Settings"]'))
    if (active) break
    await page.keyboard.press('Escape')
  }

  await page.waitForSelector('button[title*="Settings"]', { timeout: 10000 })
  await new Promise(r => setTimeout(r, 400))
}

async function getPanelMetrics(page, testId) {
  return page.evaluate(tid => {
    const el = document.querySelector(`[data-testid="${tid}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const s = window.getComputedStyle(el)
    const scrollBody = el.querySelector('[class*="overflow-y-auto"]')
    return {
      rect: {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        centerX: r.left + r.width / 2,
        centerY: r.top + r.height / 2,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      ariaModal: el.getAttribute('aria-modal'),
      role: el.getAttribute('role'),
      position: s.position,
      hasScrollBody: !!scrollBody,
      scrollHeight: scrollBody?.scrollHeight ?? 0,
      clientHeight: scrollBody?.clientHeight ?? 0,
    }
  }, testId)
}

function verifyCenteredBounds(metrics, name, vp) {
  assert(metrics !== null, `${name} did not render at ${vp.name}`)
  const { rect, viewport } = metrics
  assert(rect.width > 0 && rect.height > 0, `${name} has zero size at ${vp.name}`)
  assert(
    rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= viewport.width + 0.5 && rect.bottom <= viewport.height + 0.5,
    `${name} outside viewport at ${vp.name}: ${JSON.stringify(rect)} vs ${JSON.stringify(viewport)}`
  )
  const dx = Math.abs(rect.centerX - viewport.width / 2)
  const dy = Math.abs(rect.centerY - viewport.height / 2)
  assert(
    dx <= 2 && dy <= 2,
    `${name} not centered within 2px at ${vp.name}: dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}`
  )
  assert(metrics.ariaModal === 'true', `${name} missing aria-modal="true"`)
}

function verifyRightSheetBounds(metrics, name, vp) {
  assert(metrics !== null, `${name} did not render at ${vp.name}`)
  const { rect, viewport } = metrics
  assert(rect.width > 0 && rect.height > 0, `${name} has zero size at ${vp.name}`)
  const expectedWidth = Math.min(480, viewport.width)
  assert(
    Math.abs(rect.width - expectedWidth) <= 1,
    `${name} width mismatch at ${vp.name}: got ${rect.width}, expected ${expectedWidth}`
  )
  assert(
    Math.abs(rect.right - viewport.width) <= 1,
    `${name} not flush right at ${vp.name}: right=${rect.right}, vw=${viewport.width}`
  )
  assert(
    Math.abs(rect.top) <= 1 && Math.abs(rect.height - viewport.height) <= 1,
    `${name} height mismatch at ${vp.name}: top=${rect.top}, h=${rect.height}, vh=${viewport.height}`
  )
  assert(metrics.hasScrollBody, `${name} missing internal scroll area`)
  assert(metrics.ariaModal === 'true', `${name} missing aria-modal="true"`)
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
  })

  const consoleErrors = []
  const pageErrors = []

  try {
    const page = await browser.newPage()
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    for (const vp of VIEWPORTS) {
      console.log(`\n=== Testing ${MODE_LABEL.toUpperCase()} at ${vp.name} ===`)
      await page.setViewport({ width: vp.width, height: vp.height })
      await enterActiveMode(page)

      // 1. Voice Commands Modal
      await page.evaluate(() => {
        const btn = document.querySelector('button[title="Voice Commands Guide"]')
        if (btn) btn.click()
      })
      await new Promise(r => setTimeout(r, 450))
      const voiceMetrics = await getPanelMetrics(page, 'voice-commands-modal')
      verifyCenteredBounds(voiceMetrics, 'VoiceCommandsModal', vp)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_voice_commands.png`) })
      console.log(`  [PASS] VoiceCommandsModal centered (${voiceMetrics.rect.width.toFixed(0)}x${voiceMetrics.rect.height.toFixed(0)})`)
      await page.keyboard.press('Escape')
      await new Promise(r => setTimeout(r, 350))

      // 2. Settings Sheet (open 1st, 2nd, and 3rd time to verify repeated opens)
      for (let attempt = 1; attempt <= 3; attempt++) {
        await page.evaluate(() => {
          const btn = document.querySelector('button[title*="Settings"]')
          if (btn) btn.click()
        })
        await new Promise(r => setTimeout(r, 500))
        const settingsMetrics = await getPanelMetrics(page, 'settings-sheet')
        verifyRightSheetBounds(settingsMetrics, `SettingsSheet (attempt ${attempt})`, vp)
        if (attempt === 1) {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_settings.png`) })
          console.log(`  [PASS] SettingsSheet flush right (${settingsMetrics.rect.width.toFixed(0)}x${settingsMetrics.rect.height.toFixed(0)}, scroll=${settingsMetrics.scrollHeight}px)`)

          // 3. Confirm Dialog (opened from Purge button inside Settings)
          await page.evaluate(() => {
            const purgeBtn = Array.from(document.querySelectorAll('button')).find(b =>
              b.textContent?.includes('PURGE ALL ARCHIVES')
            )
            if (purgeBtn) purgeBtn.click()
          })
          await new Promise(r => setTimeout(r, 450))
          const confirmMetrics = await getPanelMetrics(page, 'confirm-purge-dialog')
          verifyCenteredBounds(confirmMetrics, 'ConfirmDialog', vp)
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_confirm_dialog.png`) })
          console.log(`  [PASS] ConfirmDialog centered (${confirmMetrics.rect.width.toFixed(0)}x${confirmMetrics.rect.height.toFixed(0)})`)
          await page.keyboard.press('Escape')
          await new Promise(r => setTimeout(r, 350))
        }
        await page.keyboard.press('Escape')
        await new Promise(r => setTimeout(r, 350))
      }
      console.log(`  [PASS] SettingsSheet reopened cleanly 3/3 times`)

      // 4. Command Palette (Meta+k)
      await page.keyboard.down('Meta')
      await page.keyboard.press('k')
      await page.keyboard.up('Meta')
      await new Promise(r => setTimeout(r, 450))
      const paletteMetrics = await getPanelMetrics(page, 'command-palette')
      verifyCenteredBounds(paletteMetrics, 'CommandPalette', vp)
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${vp.name}_command_palette.png`) })
      console.log(`  [PASS] CommandPalette centered (${paletteMetrics.rect.width.toFixed(0)}x${paletteMetrics.rect.height.toFixed(0)})`)
      await page.keyboard.press('Escape')
      await new Promise(r => setTimeout(r, 350))
    }

    assert(pageErrors.length === 0, `Page errors detected: ${pageErrors.join('; ')}`)
    console.log(`\nALL OVERLAY CHECKS PASSED IN ${MODE_LABEL.toUpperCase()} MODE!`)
  } finally {
    await browser.close()
  }
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
