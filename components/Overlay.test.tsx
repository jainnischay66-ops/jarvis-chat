// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Overlay } from './Overlay'
import { VoiceCommandsModal } from './VoiceCommandsModal'
import { SettingsSheet } from './SettingsSheet'
import { CommandPalette } from './CommandPalette'
import { ConfirmDialog } from './ConfirmDialog'
import { DEFAULT_PREFERENCES } from '@/lib/storage'

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 680 },
  { width: 768, height: 1024 },
  { width: 375, height: 667 },
]

// Mock ResizeObserver & matchMedia for Radix Slider / Framer Motion / SettingsSheet
beforeEach(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

afterEach(() => {
  cleanup()
})

describe('Shared Overlay Primitive & Overlays', () => {
  it('renders into document.body via portal with aria-modal and labelled heading', () => {
    render(
      <Overlay isOpen={true} onClose={vi.fn()} title="Test Dialog" panelTestId="test-dialog">
        <div>Body content</div>
      </Overlay>
    )
    const panel = screen.getByTestId('test-dialog')
    expect(panel).toBeTruthy()
    expect(panel.getAttribute('aria-modal')).toBe('true')
    expect(panel.closest('body')).toBe(document.body)
    expect(screen.getByText('Test Dialog')).toBeTruthy()
  })

  it('catches render errors in OverlayErrorBoundary and shows Retry fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function ThrowingChild(): React.ReactElement {
      throw new Error('ChunkLoadError: failed to load settings chunk')
    }
    render(
      <Overlay
        isOpen={true}
        onClose={vi.fn()}
        title="Settings"
        errorFallbackLabel="settings"
        panelTestId="err-dialog"
      >
        <ThrowingChild />
      </Overlay>
    )
    expect(screen.getByText(/Could not load settings\. Retry\./i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeTruthy()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  for (const vp of VIEWPORTS) {
    it(`positions centered overlays and right sheet properly at ${vp.width}x${vp.height}`, () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: vp.width })
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: vp.height })

      // 1. VoiceCommandsModal
      const { unmount: unmountVoice } = render(
        <VoiceCommandsModal isOpen={true} onClose={vi.fn()} />
      )
      const voicePanel = screen.getByTestId('voice-commands-modal')
      const voiceWrapper = voicePanel.parentElement as HTMLElement
      expect(voiceWrapper.style.position).toBe('fixed')
      expect(voiceWrapper.style.display).toBe('grid')
      expect(voiceWrapper.style.placeItems).toBe('center')
      expect(voicePanel.getAttribute('style')).toContain('560px')
      expect(voicePanel.getAttribute('style')).toContain('100vw - 32px')
      expect(voicePanel.getAttribute('style')).toContain('85dvh')
      expect(voicePanel.getAttribute('style')).toContain('720px')
      unmountVoice()

      // 2. CommandPalette
      const { unmount: unmountPalette } = render(
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          onNewChat={vi.fn()}
          onOpenSettings={vi.fn()}
          onSelectConversation={vi.fn()}
          conversations={[]}
          preferences={DEFAULT_PREFERENCES}
          onUpdatePreferences={vi.fn()}
        />
      )
      const palettePanel = screen.getByTestId('command-palette')
      const paletteWrapper = palettePanel.parentElement as HTMLElement
      expect(paletteWrapper.style.position).toBe('fixed')
      expect(paletteWrapper.style.display).toBe('grid')
      expect(paletteWrapper.style.placeItems).toBe('center')
      unmountPalette()

      // 3. ConfirmDialog
      const { unmount: unmountConfirm } = render(
        <ConfirmDialog
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Confirm Action"
          description="Are you sure?"
        />
      )
      const confirmPanel = screen.getByTestId('confirm-dialog')
      expect(confirmPanel.getAttribute('style')).toContain('440px')
      expect(confirmPanel.getAttribute('style')).toContain('100vw - 32px')
      unmountConfirm()

      // 4. SettingsSheet
      const { unmount: unmountSettings } = render(
        <SettingsSheet
          isOpen={true}
          onClose={vi.fn()}
          preferences={DEFAULT_PREFERENCES}
          onUpdatePreferences={vi.fn()}
          conversations={[]}
          onImportData={vi.fn()}
          onClearAllData={vi.fn()}
        />
      )
      const settingsPanel = screen.getByTestId('settings-sheet')
      expect(settingsPanel.style.position).toBe('fixed')
      expect(settingsPanel.style.top).toBe('0px')
      expect(settingsPanel.style.right).toBe('0px')
      expect(settingsPanel.style.height).toBe('100dvh')
      expect(settingsPanel.getAttribute('style')).toContain('480px')
      expect(settingsPanel.getAttribute('style')).toContain('100vw')
      unmountSettings()
    })
  }

  it('closes overlay on Escape key press', () => {
    const onClose = vi.fn()
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        title="Confirm"
        description="Proceed?"
      />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
