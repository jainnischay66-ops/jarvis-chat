import puppeteer from 'puppeteer-core'
import fs from 'fs'

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SCREENSHOT_DIR = '/Users/nischayjain/.gemini/antigravity/brain/c4c62c9c-de34-4c85-9cb9-9894ca7d33c8/scratch'

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const envPath = '.env.local'
  const originalEnv = fs.readFileSync(envPath, 'utf8')

  console.log('--- STEP 1: Pointing base URL to closed port ---')
  const closedEnv = originalEnv.replace(/OPENAI_BASE_URL=.*/, 'OPENAI_BASE_URL=http://127.0.0.1:54321/v1')
  fs.writeFileSync(envPath, closedEnv)
  await sleep(1500)

  console.log('--- Launching Chrome ---')
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 },
  })

  try {
    const page = await browser.newPage()
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' })
    await sleep(1000)

    // Wake up JARVIS from StandbyScreen
    console.log('--- Waking up JARVIS from StandbyScreen ---')
    const standbyInput = await page.waitForSelector('input[placeholder*="Wake up, JARVIS"]')
    await standbyInput.type('Wake up, JARVIS')
    await page.keyboard.press('Enter')
    await sleep(1000) // wait past 800ms skip-safety grace period

    // Skip the boot film to reach ACTIVE state immediately
    console.log('--- Skipping boot film to reach ACTIVE chat HUD ---')
    await page.keyboard.press('Escape')
    await sleep(500)

    // Type a message in the composer
    console.log('--- Waiting for chat composer textarea ---')
    const textarea = await page.waitForSelector('textarea', { timeout: 10000 })
    await textarea.type('Testing closed port network error')
    await page.keyboard.press('Enter')

    console.log('--- Waiting for network error & RETRY PROTOCOL button ---')
    await page.waitForFunction(
      () => {
        const text = document.body.innerText
        return text.includes('TRANSMISSION FAILED') && text.includes('RETRY PROTOCOL')
      },
      { timeout: 20000 }
    )

    const errorDetails = await page.evaluate(() => {
      const errEl = document.querySelector('p.font-mono.text-xs')
      return errEl ? errEl.innerText : document.body.innerText
    })
    console.log('Error banner text captured in browser:', errorDetails)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/browser_closed_port_error.png` })
    console.log('Saved screenshot: browser_closed_port_error.png')

    // STEP 2: Restore original base URL and test retry
    console.log('--- STEP 2: Restoring original base URL (Groq) ---')
    fs.writeFileSync(envPath, originalEnv)
    await sleep(2000)

    console.log('--- Clicking RETRY PROTOCOL button in browser ---')
    const buttons = await page.$$('button')
    let clicked = false
    for (const b of buttons) {
      const text = await b.evaluate(el => el.innerText)
      if (text.includes('RETRY PROTOCOL')) {
        await b.click()
        clicked = true
        break
      }
    }
    if (!clicked) {
      console.log('Clicking composer Enter instead')
      await page.keyboard.press('Enter')
    }

    console.log('--- Waiting for successful response text ---')
    await page.waitForFunction(
      () => {
        const text = document.body.innerText
        return !text.includes('TRANSMISSION FAILED') && text.length > 50
      },
      { timeout: 25000 }
    )

    await sleep(2000)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/browser_normal_chat_success.png` })
    console.log('Saved screenshot: browser_normal_chat_success.png')
    console.log('ALL BROWSER VERIFICATIONS PASSED!')
  } finally {
    fs.writeFileSync(envPath, originalEnv)
    await browser.close()
  }
}

main().catch(err => {
  console.error('Browser test failed:', err)
  process.exit(1)
})
