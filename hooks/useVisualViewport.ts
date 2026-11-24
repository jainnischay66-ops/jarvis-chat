'use client'

import { useState, useEffect } from 'react'

export function useVisualViewport() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const handleResize = () => {
      const vv = window.visualViewport
      if (!vv) return
      const heightDiff = window.innerHeight - vv.height
      setKeyboardHeight(heightDiff > 100 ? heightDiff : 0)
      setViewportHeight(vv.height)
    }

    window.visualViewport.addEventListener('resize', handleResize)
    window.visualViewport.addEventListener('scroll', handleResize)
    handleResize()

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('scroll', handleResize)
    }
  }, [])

  return { keyboardHeight, viewportHeight }
}
