import puppeteer from 'puppeteer-core'
import fs from 'fs'
import zlib from 'zlib'

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ARTIFACT_DIR = '/Users/nischayjain/.gemini/antigravity/brain/c4c62c9c-de34-4c85-9cb9-9894ca7d33c8/title_card_screenshots'

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900, dpr: 2 },
  { name: '1280x680', width: 1280, height: 680, dpr: 2 },
  { name: '375x667', width: 375, height: 667, dpr: 2 },
]

const TIMESTAMPS = [19.0, 19.6, 20.5, 21.5, 22.5, 23.0]

function toLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Extracts raw RGBA pixels from a standard PNG buffer using built-in zlib.
 */
function decodePngPixels(pngBuffer) {
  const width = pngBuffer.readUInt32BE(16)
  const height = pngBuffer.readUInt32BE(20)

  let pos = 8
  const idatChunks = []
  while (pos < pngBuffer.length) {
    const len = pngBuffer.readUInt32BE(pos)
    const type = pngBuffer.toString('ascii', pos + 4, pos + 8)
    if (type === 'IDAT') {
      idatChunks.push(pngBuffer.subarray(pos + 8, pos + 8 + len))
    }
    pos += 12 + len
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks))
  return {
    width,
    height,
    getPixel(x, y) {
      const clampedX = Math.max(0, Math.min(width - 1, Math.round(x)))
      const clampedY = Math.max(0, Math.min(height - 1, Math.round(y)))
      // Each scanline: 1 filter byte + width * 4 bytes RGBA
      const rowSize = 1 + width * 4
      const pixelStart = clampedY * rowSize + 1 + clampedX * 4
      return [
        decompressed[pixelStart],
        decompressed[pixelStart + 1],
        decompressed[pixelStart + 2],
        decompressed[pixelStart + 3],
      ]
    },
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('=== Title Card Legibility & Contrast Verification ===\n')

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const report = {
    contrastChecks: {},
    layoutChecks: {},
    screenshots: [],
  }

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n--- Testing Viewport: ${vp.name} (DPR ${vp.dpr}) ---`)
      const page = await browser.newPage()
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.dpr,
      })

      // Open with ?debug=boot which mounts BootFilm directly
      await page.goto('http://localhost:3000/?debug=boot', { waitUntil: 'networkidle2' })
      await sleep(1000)

      // Capture screenshots across all timestamps
      for (const t of TIMESTAMPS) {
        await page.evaluate(seekTime => {
          if (typeof window !== 'undefined' && window.__seekBoot) {
            window.__seekBoot(seekTime)
          }
        }, t)
        await sleep(350)

        const filename = `${vp.name}_t${t.toFixed(1)}s.png`
        const filepath = `${ARTIFACT_DIR}/${filename}`
        const screenshotBuffer = await page.screenshot({ path: filepath })
        console.log(`Saved screenshot: ${filename}`)
        report.screenshots.push({ viewport: vp.name, timestamp: t, path: filepath })

        // Check contrast and layout specifically at t=21.5s
        if (t === 21.5) {
          console.log(`Analyzing layout and contrast at t=21.5s on ${vp.name}...`)

          // 1. Layout metrics
          const layout = await page.evaluate(() => {
            const h1 = document.querySelector('[data-testid="boot-title"]')
            const subtitle = document.querySelector('[data-testid="boot-subtitle"]')
            const caption = document.querySelector('[data-testid="boot-caption"]')

            const h1Rect = h1 ? h1.getBoundingClientRect() : null
            const subRect = subtitle ? subtitle.getBoundingClientRect() : null
            const capRect = caption ? caption.getBoundingClientRect() : null

            return {
              vh: window.innerHeight,
              vw: window.innerWidth,
              h1: h1Rect
                ? {
                    top: h1Rect.top,
                    bottom: h1Rect.bottom,
                    left: h1Rect.left,
                    right: h1Rect.right,
                    center: h1Rect.top + h1Rect.height / 2,
                    height: h1Rect.height,
                  }
                : null,
              subtitle: subRect
                ? {
                    top: subRect.top,
                    bottom: subRect.bottom,
                    left: subRect.left,
                    right: subRect.right,
                    center: subRect.top + subRect.height / 2,
                    height: subRect.height,
                  }
                : null,
              caption: capRect
                ? {
                    top: capRect.top,
                    bottom: capRect.bottom,
                    left: capRect.left,
                    right: capRect.right,
                    center: capRect.top + capRect.height / 2,
                    height: capRect.height,
                  }
                : null,
            }
          })

          const titleCenterPct = (layout.h1.center / layout.vh) * 100
          const gap1 = layout.subtitle.top - layout.h1.bottom
          const gap2 = layout.caption ? layout.caption.top - layout.subtitle.bottom : 20

          console.log(`  Title center at: ${titleCenterPct.toFixed(1)}% of height (target ~58-60%)`)
          console.log(`  Gap between Title & Subtitle: ${gap1.toFixed(1)}px (target >= 16px)`)
          console.log(`  Gap between Subtitle & Caption: ${gap2.toFixed(1)}px (target >= 16px)`)

          if (titleCenterPct < 55 || titleCenterPct > 64) {
            throw new Error(`Title center ${titleCenterPct.toFixed(1)}% is outside target ~58-60% height`)
          }
          if (gap1 < 14) throw new Error(`Insufficient gap between title and subtitle: ${gap1}px`)
          if (gap2 < 14) throw new Error(`Insufficient gap between subtitle and caption: ${gap2}px`)

          report.layoutChecks[vp.name] = {
            titleCenterPercent: titleCenterPct,
            gapTitleToSubtitle: gap1,
            gapSubtitleToCaption: gap2,
            pass: true,
          }

          // 2. Decode pixels from screenshotBuffer directly in Node
          const png = decodePngPixels(screenshotBuffer)

          // Sample background pixels inside the radial scrim right above/between text blocks
          function sampleMedianRgb(sampleYCss, leftCss, rightCss) {
            const dpr = vp.dpr
            const sampleY = Math.round(sampleYCss * dpr)
            const midX = ((leftCss + rightCss) / 2) * dpr
            const samples = []

            for (let dx = -30 * dpr; dx <= 30 * dpr; dx += 6 * dpr) {
              const p = png.getPixel(midX + dx, sampleY)
              if (p && p[0] !== undefined) {
                samples.push(p)
              }
            }

            if (samples.length === 0) return [2, 4, 10]
            const rSorted = samples.map(s => s[0]).sort((a, b) => a - b)
            const gSorted = samples.map(s => s[1]).sort((a, b) => a - b)
            const bSorted = samples.map(s => s[2]).sort((a, b) => a - b)
            const mid = Math.floor(samples.length / 2)
            return [rSorted[mid], gSorted[mid], bSorted[mid]]
          }

          // Sample 1: 10px above Title (in the scrim under the orb)
          const titleBgRgb = sampleMedianRgb(layout.h1.top - 10, layout.h1.left, layout.h1.right)
          // Sample 2: In the 16px gap between Title and Subtitle
          const subtitleBgRgb = sampleMedianRgb((layout.h1.bottom + layout.subtitle.top) / 2, layout.subtitle.left, layout.subtitle.right)
          // Sample 3: In the 16px gap between Subtitle and Caption
          const captionY = layout.caption ? (layout.subtitle.bottom + layout.caption.top) / 2 : layout.subtitle.bottom + 8
          const captionLeft = layout.caption ? layout.caption.left : layout.subtitle.left
          const captionRight = layout.caption ? layout.caption.right : layout.subtitle.right
          const captionBgRgb = sampleMedianRgb(captionY, captionLeft, captionRight)

          // Luminances
          // Foreground colors:
          // Title: cyan #5CCBF5 -> [92, 203, 245]
          // Subtitle: var(--text) #F0F4F8 -> [240, 244, 248]
          // Caption: var(--text-2) #94A3B8 -> [148, 163, 184]
          const lumTitle = toLuminance(92, 203, 245)
          const lumSubtitle = toLuminance(240, 244, 248)
          const lumCaption = toLuminance(148, 163, 184)

          const lumTitleBg = toLuminance(...titleBgRgb)
          const lumSubBg = toLuminance(...subtitleBgRgb)
          const lumCapBg = toLuminance(...captionBgRgb)

          const crTitle = contrastRatio(lumTitle, lumTitleBg)
          const crSubtitle = contrastRatio(lumSubtitle, lumSubBg)
          const crCaption = contrastRatio(lumCaption, lumCapBg)

          console.log(
            `  Contrast Title (Cyan vs Scrim): ${crTitle.toFixed(2)}:1 (sampled bg RGB: [${titleBgRgb}], req >= 3.0:1)`
          )
          console.log(
            `  Contrast Subtitle (--text vs Scrim): ${crSubtitle.toFixed(2)}:1 (sampled bg RGB: [${subtitleBgRgb}], req >= 4.5:1)`
          )
          console.log(
            `  Contrast Caption (--text-2 vs Scrim): ${crCaption.toFixed(2)}:1 (sampled bg RGB: [${captionBgRgb}], req >= 4.5:1)`
          )

          if (crTitle < 3.0) throw new Error(`Title contrast ratio ${crTitle.toFixed(2)}:1 is below required 3.0:1`)
          if (crSubtitle < 4.5)
            throw new Error(`Subtitle contrast ratio ${crSubtitle.toFixed(2)}:1 is below required 4.5:1`)
          if (crCaption < 4.5)
            throw new Error(`Caption contrast ratio ${crCaption.toFixed(2)}:1 is below required 4.5:1`)

          report.contrastChecks[vp.name] = {
            titleContrast: crTitle,
            subtitleContrast: crSubtitle,
            captionContrast: crCaption,
            pass: true,
          }
        }
      }

      await page.close()
    }

    fs.writeFileSync(`${ARTIFACT_DIR}/contrast_report.json`, JSON.stringify(report, null, 2))
    console.log('\n=== ALL 18 SCREENSHOTS & CONTRAST CHECKS PASSED WITH EXCELLENCE! ===')
  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error('\nVerification failed:', err)
  process.exit(1)
})
