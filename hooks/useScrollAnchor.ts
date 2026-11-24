'use client'

import { useState, useEffect, useCallback, RefObject } from 'react'

export function useScrollAnchor(containerRef: RefObject<HTMLDivElement | null>) {
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const checkIfAtBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const threshold = 120
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
    setIsAtBottom(atBottom)
    setShowScrollButton(!atBottom && el.scrollHeight > el.clientHeight + 200)
  }, [containerRef])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let timeoutId: any
    const handleScroll = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(checkIfAtBottom, 40)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    checkIfAtBottom()

    return () => {
      el.removeEventListener('scroll', handleScroll)
      clearTimeout(timeoutId)
    }
  }, [containerRef, checkIfAtBottom])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    })
    setIsAtBottom(true)
    setShowScrollButton(false)
  }, [containerRef])

  return {
    isAtBottom,
    showScrollButton,
    scrollToBottom,
  }
}
