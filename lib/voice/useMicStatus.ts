'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  detectVoiceSupport,
  getMicStatusLabel,
  queryMicPermission,
  UNSUPPORTED_BROWSER_MESSAGE,
  type MicPermissionState,
  type MicStatusLabel,
} from './capabilities'

export interface UseMicStatusResult {
  voiceSupported: boolean
  permissionState: MicPermissionState
  statusLabel: MicStatusLabel
  unsupportedMessage: string | null
  refreshPermission: () => Promise<void>
  markPermissionState: (state: MicPermissionState) => void
}

export function useMicStatus(): UseMicStatusResult {
  const [voiceSupported, setVoiceSupported] = useState(true)
  const [permissionState, setPermissionState] = useState<MicPermissionState>('prompt')

  const refreshPermission = useCallback(async () => {
    const support = detectVoiceSupport()
    if (!support.supported) {
      setVoiceSupported(false)
      setPermissionState('unsupported')
      return
    }

    setVoiceSupported(true)
    const result = await queryMicPermission()
    setPermissionState(result.state)
    if (result.state === 'unsupported') {
      setVoiceSupported(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    let permStatusObj: PermissionStatus | null = null
    let handleChange: (() => void) | null = null

    async function init() {
      const support = detectVoiceSupport()
      if (!active) return

      if (!support.supported) {
        setVoiceSupported(false)
        setPermissionState('unsupported')
        return
      }

      setVoiceSupported(true)
      const result = await queryMicPermission()
      if (!active) return

      setPermissionState(result.state)
      if (result.state === 'unsupported') {
        setVoiceSupported(false)
      }

      if (result.permissionStatus) {
        permStatusObj = result.permissionStatus
        handleChange = () => {
          if (!active || !permStatusObj) return
          const next = permStatusObj.state
          if (next === 'granted' || next === 'denied' || next === 'prompt') {
            setPermissionState(next)
          }
        }
        permStatusObj.addEventListener?.('change', handleChange)
      }
    }

    init()

    return () => {
      active = false
      if (permStatusObj && handleChange) {
        permStatusObj.removeEventListener?.('change', handleChange)
      }
    }
  }, [])

  const markPermissionState = useCallback((state: MicPermissionState) => {
    setPermissionState(state)
    if (state === 'unsupported') {
      setVoiceSupported(false)
    }
  }, [])

  return {
    voiceSupported,
    permissionState,
    statusLabel: getMicStatusLabel(permissionState),
    unsupportedMessage: voiceSupported ? null : UNSUPPORTED_BROWSER_MESSAGE,
    refreshPermission,
    markPermissionState,
  }
}
