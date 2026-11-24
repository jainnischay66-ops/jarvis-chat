# J.A.R.V.I.S. — Project Context & Architecture Overview

> **Single Source of Truth** for the J.A.R.V.I.S. Web Client application.
> Designed for onboarding AI assistants, developers, and context handoffs.
> Last updated: November 24, 2026

---

## 1. Project Purpose & High-Level Identity

**J.A.R.V.I.S.** is a personal AI assistant web application featuring a bespoke **Stark HUD (Holographic User Interface)** aesthetic inspired by Tony Stark's Iron Man interface. It is direct, honest, concise, and futuristic, blending real-time LLM streaming with rich 3D WebGL reactive visualizations, voice synthesis/recognition, client-side IndexedDB persistence, and keyboard-first productivity workflows.

- **Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Three.js, React Three Fiber (`@react-three/fiber`), Postprocessing (`@react-three/postprocessing`), Framer Motion, Lucide Icons, `idb-keyval`.
- **Target Viewport Baseline**: Designed short-laptop first (`1280x680px`), scaling down to mobile (`375x667px`) and up to desktop (`1440x800px+`) with zero element overlap and zero horizontal overflow.

---

## 2. Visual Design System ("Stark HUD")

All visual styles are dark-only, governed by `styles/tokens.css` and `styles/holo.css`.

### Color Palette & Semantic Roles
- `--bg: #02040A` — Deep obsidian background.
- `--surface: rgba(8, 20, 32, 0.55)` & `--surface-hi: rgba(14, 36, 54, 0.7)` — Glassmorphic holographic surfaces with `backdrop-filter: blur(16px)`.
- `--cyan: #5CCBF5` — Primary interface color: borders, user message bubbles, send button, focus rings, corner brackets.
- `--gold: #F2B84B` — Secondary accent: core orb warm lighting, active sidebar conversation rail (2px), assistant message nodes, speaking state.
- `--red: #FF4D4D` — Destructive / alert actions: errors, delete chat, stop generation.
- `--text: #E6F7FF` & `--text-2: rgba(200, 235, 250, 0.66)` & `--text-3: rgba(200, 235, 250, 0.38)` — Hierarchy typography.
- `--line: rgba(92, 203, 245, 0.22)` — Hairline holographic borders.
- `--chamfer: 14px` (or `10px` on small elements) — Chamfered corners drawn using CSS `clip-path: polygon(...)`.

### Typography (Loaded via `next/font/google`)
1. **Orbitron (600)**: Reserved strictly for the wordmark (`J.A.R.V.I.S.`).
2. **Rajdhani (500/600)**: Headings, buttons, labels, and status badges. Displayed in uppercase with tracking (`0.12em`).
3. **Inter (Variable)**: Message content, user prose, suggestions. Clean 16px / 1.6 line-height, never uppercase.
4. **JetBrains Mono**: Readouts, telemetry clock, model names, timestamps, and code blocks.

### Holographic Styling & De-Clutter Rules
- **Corner Brackets (`.holo-brackets::before`)**: Cyan 10px L-shapes (1.5px thick). Strictly opt-in; only appear on 5 macro components:
  1. Sidebar panel
  2. Composer box
  3. User message bubbles
  4. Settings sheet dialog
  5. Command palette modal
  *(Never on chips, buttons, list rows, or inputs).*
- **Scanlines (`.holo-scanlines::after`)**: Subtle 2px repeating horizontal lines. Strictly restricted to Sidebar, TopBar, and Composer.
- **HUD Backdrop (`.hud-grid-backdrop`)**: Fixed background with 60px CSS grid lines in cyan at 4% opacity with radial vignette.

---

## 3. Layout & App Skeleton Grid

The application uses an explicit CSS Grid architecture to avoid floating/fixed bar overlap:

```
+-------------------------------------------------------------------+
| .app (100dvh, grid: 260px 1fr  [or 0px 1fr on mobile/collapsed])   |
| +------------+--------------------------------------------------+ |
| |  SIDEBAR   |  .main (grid-template-rows: 56px 1fr auto)       | |
| |  (Col 1)   |  +--------------------------------------------+  | |
| |            |  | Row 1: TopBar (56px fixed height)          |  | |
| |            |  +--------------------------------------------+  | |
| |            |  | Row 2: .scroll (minmax(0, 1fr) overflow-y)  |  | |
| |            |  |   .column (max-w-[760px] mx-auto px-4)     |  | |
| |            |  |   [Empty State OR MessageList]             |  | |
| |            |  +--------------------------------------------+  | |
| |            |  | Row 3: .composer-wrap (in-flow, auto)      |  | |
| |            |  |   .column (max-w-[760px] mx-auto px-4)     |  | |
| |            |  |   [Composer Box]                           |  | |
| |            |  +--------------------------------------------+  | |
| +------------+--------------------------------------------------+ |
+-------------------------------------------------------------------+
```

- **In-Flow Composer**: Sits in grid row 3. It is **NOT** `position: fixed` or `absolute`. Messages naturally scroll above it and can never be hidden beneath it.
- **Spacing Scale**: Enforces strict increments only: `4, 8, 12, 16, 24, 32px`.

---

## 4. Key Components Breakdown

### 1. `components/JarvisOrb.tsx` & `JarvisCore.tsx`
- **`JarvisOrb`**: High-performance 3D WebGL particle sphere built with Three.js and `@react-three/fiber`.
  - Shader: Custom GLSL noise displacement, assembly/scatter morphing, audio-reactive radius pulsing via `uLevel`, `uThink`, `uWarm`.
  - Particles: 9,000 on desktop, 3,500 on mobile.
  - Rings: Animated tick marks, arcs, and concentric rings rotating on tilted 3D planes.
  - Mask: Sits inside a container masked with `radial-gradient(closest-side, #000 62%, transparent 100%)` so the orb fades into `--bg` without a visible bounding box.
- **`JarvisCore`**: 2D SVG canvas fallback with normalized arc sweeps and animated waveform bars. Automatically renders when WebGL is unavailable or on low-end devices.

### 2. `components/EmptyState.tsx`
- Orb stage: `height: clamp(180px, 36dvh, 340px); aspect-ratio: 1;`.
- Greeting: `GOOD EVENING, SIR.` in Rajdhani 600, positioned 16px below the orb stage (no overlap).
- Readout: Mono telemetry line `SYSTEMS ONLINE · HH:MM:SS`.
- Suggestion Chips: 2 columns (1 column on mobile), 10px chamfer, `min-height: 52px`, left-aligned Inter typography. Automatically hides 3rd and 4th chips when viewport height $\le 560\text{px}$.
- Fits completely inside `1280x680px` without triggering scroll.

### 3. `components/TopBar.tsx`
- Fixed 56px height, single row.
- Left: 44px hit-area sidebar toggle, miniature 28px rotating `ArcReactor`, and Orbitron 13px wordmark.
- Center: Active conversation title in Rajdhani uppercase with tracking and ellipsis; active model name beneath in 11px mono `text-3`.
- Right: Online status pill (`ONLINE` / `OFFLINE PROTOCOL`) and 44px settings gear button.

### 4. `components/Sidebar.tsx`
- Desktop: 260px wide grid column 1.
- Mobile: Framer Motion slide-over drawer with backdrop blur.
- "New Archive" button (44px height, hairline border, no brackets).
- Search input (40px height).
- Conversation rows: 44px height, single line with `text-overflow: ellipsis`, 2px gold left rail on active row.
- Group labels: `TODAY`, `PREVIOUS 7 DAYS`, etc., in Rajdhani 11px uppercase.

### 5. `components/Composer.tsx`
- Auto-growing textarea (56px at rest, grows up to 8 lines).
- Icons in 44px touch areas (attachment clip, voice microphone).
- 40px rotating Arc Reactor send button with cyan glow.
- Status indicator: Subtle 11px mono text (`LISTENING`, `THINKING`) appears 8px above composer only during active non-ready states; completely hidden when ready.

### 6. `components/Message.tsx` & `MessageList.tsx`
- **User Messages**: Right-aligned, max 80% width, `.chamfer-card .holo-brackets`, cyan border, `--cyan-faint` background.
- **Assistant Messages**: Left rail in `var(--line)` with an amber/gold glowing dot on the first line next to `"J.A.R.V.I.S."`.
- **Code Blocks**: Chamfered header with language tag, execution/copy button, JetBrains Mono font.

---

## 5. Storage, State & Chat Engine

### Storage (`lib/storage/`)
- Pure client-side IndexedDB using `idb-keyval` (database: `'jarvis-db'`, store: `'conversations'`).
- UI preferences stored in `localStorage` under `'jarvis-preferences'`.
- Supports multi-conversation management, auto-titling, pinning, soft-delete with toast undo, search, JSON export/import.

### LLM Providers (`lib/llm/` & `app/api/chat/route.ts`)
- Provider abstraction supporting:
  - **Google Gemini** (`gemini-2.0-flash`, `gemini-1.5-pro`)
  - **Anthropic Claude** (`claude-3-5-sonnet-latest`, etc.)
  - **OpenAI / OpenAI-Compatible**
- Streaming responses via Server-Sent Events (SSE).
- IP-based sliding-window rate limiting in `lib/rate-limit.ts`.

### Voice & Sound (`hooks/useVoice.ts`)
- Speech recognition via Web Speech API (`webkitSpeechRecognition`).
- Text-to-Speech synthesis with sentence chunking.
- Live audio-reactive level calculation driving the `level` prop of the visual core.

---

## 6. Testing, Verification & Tooling

- **Test Framework**: Vitest (`npm test`). 100% pass rate across 4 test suites (19 unit tests).
- **TypeScript**: `npx tsc --noEmit` clean with 0 errors.
- **Verification Scripts**:
  - `scripts/verify-layout.js`: Puppeteer script verifying layout across 5 viewports (`1280x600`, `1280x680`, `1440x800`, `768x1024`, `375x667`), checking horizontal overflow, bounding boxes, centering, and message rendering.
  - `scripts/capture-preview.js`: State capture for `/jarvis-preview`.
- **Server Rule**: Run only ONE Next.js dev server at a time. Clean `.next` before running type checks or test suites.

---

## 7. Current Project Status

- **Branch**: `main`
- **Latest Commit**: `05c161d` — `fix(layout): apply Stark HUD layout pass for short viewports, skeleton grid, and orb patch`
- **Dev Server**: Running on `http://localhost:3000` (Routes `/`, `/jarvis-preview`, and `/api/chat` fully operational).
