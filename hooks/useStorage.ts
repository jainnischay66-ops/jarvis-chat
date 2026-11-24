'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getStorage,
  getUIPreferences,
  saveUIPreferences,
  Conversation,
  UIPreferences,
} from '@/lib/storage'
import { generateId } from '@/lib/utils'

export interface GroupedConversations {
  label: string
  conversations: Conversation[]
}

export function useStorage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [preferences, setPreferences] = useState<UIPreferences>(getUIPreferences())
  const [isLoading, setIsLoading] = useState(true)

  const storage = getStorage()

  const loadConversations = useCallback(async () => {
    setIsLoading(true)
    try {
      const all = await storage.getAllConversations()
      // Filter out and purge any empty conversations from storage
      const nonEmpty = all.filter(c => c.messages && c.messages.length > 0)
      const emptyOrphans = all.filter(c => !c.messages || c.messages.length === 0)
      for (const orphan of emptyOrphans) {
        storage.deleteConversation(orphan.id).catch(() => {})
      }

      setConversations(nonEmpty)

      const prefs = getUIPreferences()
      setPreferences(prefs)

      if (prefs.lastConversationId) {
        const last = nonEmpty.find(c => c.id === prefs.lastConversationId)
        if (last) {
          setCurrentConversation(last)
          setIsLoading(false)
          return
        }
      }

      if (nonEmpty.length > 0) {
        setCurrentConversation(nonEmpty[0])
      } else {
        // Ephemeral initial conversation (NOT persisted to storage until first message)
        const initial: Conversation = {
          id: generateId(),
          title: 'New conversation',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        setCurrentConversation(initial)
      }
    } catch (e) {
      console.warn('Failed to initialize storage:', e)
    } finally {
      setIsLoading(false)
    }
  }, [storage])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const selectConversation = useCallback(
    async (id: string) => {
      const loaded = await storage.getConversation(id)
      if (loaded) {
        setCurrentConversation(loaded)
        saveUIPreferences({ lastConversationId: id })
      } else {
        const found = conversations.find(c => c.id === id)
        if (found) {
          setCurrentConversation(found)
          saveUIPreferences({ lastConversationId: id })
        }
      }
    },
    [conversations, storage]
  )

  const createConversation = useCallback(async (): Promise<Conversation> => {
    // If current conversation is already empty, reuse it instead of duplicating
    if (currentConversation && (!currentConversation.messages || currentConversation.messages.length === 0)) {
      return currentConversation
    }
    const newConv: Conversation = {
      id: generateId(),
      title: 'New conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    // Set as active draft; do not persist to IndexedDB until first message is sent
    setCurrentConversation(newConv)
    saveUIPreferences({ lastConversationId: newConv.id })
    return newConv
  }, [currentConversation])

  const updateConversation = useCallback(
    async (conv: Conversation) => {
      const updated = { ...conv, updatedAt: Date.now() }
      if (updated.messages && updated.messages.length > 0) {
        await storage.saveConversation(updated)
      }
      setConversations(prev => {
        const without = prev.filter(c => c.id !== updated.id)
        if (!updated.messages || updated.messages.length === 0) {
          return without
        }
        return [updated, ...without].sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          return b.updatedAt - a.updatedAt
        })
      })
      setCurrentConversation(curr => (!curr || curr.id === updated.id ? updated : curr))
    },
    [storage]
  )

  const deleteConversation = useCallback(
    async (id: string): Promise<{ conversation: Conversation; index: number }> => {
      const index = conversations.findIndex(c => c.id === id)
      const conv = conversations[index]
      await storage.deleteConversation(id)

      const remaining = conversations.filter(c => c.id !== id)
      setConversations(remaining)

      if (currentConversation?.id === id) {
        if (remaining.length > 0) {
          setCurrentConversation(remaining[0])
          saveUIPreferences({ lastConversationId: remaining[0].id })
        } else {
          // Create empty one
          const fresh: Conversation = {
            id: generateId(),
            title: 'New conversation',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          await storage.saveConversation(fresh)
          setConversations([fresh])
          setCurrentConversation(fresh)
          saveUIPreferences({ lastConversationId: fresh.id })
        }
      }

      return { conversation: conv, index }
    },
    [conversations, currentConversation, storage]
  )

  const undoDelete = useCallback(
    async (conv: Conversation) => {
      await storage.saveConversation(conv)
      setConversations(prev => [conv, ...prev.filter(c => c.id !== conv.id)])
      setCurrentConversation(conv)
      saveUIPreferences({ lastConversationId: conv.id })
    },
    [storage]
  )

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const trimmedTitle = title.trim() || 'Untitled'
      const existing = await storage.getConversation(id)
      if (existing) {
        const updated = { ...existing, title: trimmedTitle }
        await storage.saveConversation(updated)
      }
      setConversations(prev =>
        prev.map(c => (c.id === id ? { ...c, title: trimmedTitle } : c))
      )
      setCurrentConversation(curr =>
        curr?.id === id ? { ...curr, title: trimmedTitle } : curr
      )
    },
    [storage]
  )

  const pinConversation = useCallback(
    async (id: string) => {
      const existing = await storage.getConversation(id)
      if (!existing) return
      const nextPinned = !existing.pinned
      const updated = { ...existing, pinned: nextPinned }
      await storage.saveConversation(updated)
      setConversations(prev => {
        const updatedList = prev.map(c => (c.id === id ? { ...c, pinned: nextPinned } : c))
        return [...updatedList].sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          return b.updatedAt - a.updatedAt
        })
      })
      setCurrentConversation(curr =>
        curr?.id === id ? { ...curr, pinned: nextPinned } : curr
      )
    },
    [storage]
  )

  const updatePreferences = useCallback((newPrefs: Partial<UIPreferences>) => {
    saveUIPreferences(newPrefs)
    setPreferences(prev => ({ ...prev, ...newPrefs }))
  }, [])

  const saveDraft = useCallback(
    (convId: string, draft: string) => {
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, draft } : c))
      )
    },
    []
  )

  const saveScrollPosition = useCallback(
    (convId: string, scrollPosition: number) => {
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, scrollPosition } : c))
      )
    },
    []
  )

  const getGroupedConversations = useCallback((): GroupedConversations[] => {
    const pinned: Conversation[] = []
    const today: Conversation[] = []
    const yesterday: Conversation[] = []
    const prev7Days: Conversation[] = []
    const older: Conversation[] = []

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfYesterday = startOfToday - 86400000
    const startOf7Days = startOfToday - 6 * 86400000

    const seenIds = new Set<string>()

    conversations.forEach(c => {
      // Never display empty conversations or duplicate items in sidebar groups
      if (!c.messages || c.messages.length === 0) return
      if (seenIds.has(c.id)) return
      seenIds.add(c.id)

      if (c.pinned) {
        pinned.push(c)
        return
      }
      const t = c.updatedAt
      if (t >= startOfToday) {
        today.push(c)
      } else if (t >= startOfYesterday) {
        yesterday.push(c)
      } else if (t >= startOf7Days) {
        prev7Days.push(c)
      } else {
        older.push(c)
      }
    })

    const groups: GroupedConversations[] = []
    if (pinned.length > 0) groups.push({ label: 'Pinned', conversations: pinned })
    if (today.length > 0) groups.push({ label: 'Today', conversations: today })
    if (yesterday.length > 0) groups.push({ label: 'Yesterday', conversations: yesterday })
    if (prev7Days.length > 0) groups.push({ label: 'Previous 7 days', conversations: prev7Days })
    if (older.length > 0) groups.push({ label: 'Older', conversations: older })

    return groups
  }, [conversations])

  return {
    conversations,
    currentConversation,
    preferences,
    isLoading,
    selectConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    undoDelete,
    renameConversation,
    pinConversation,
    updatePreferences,
    saveDraft,
    saveScrollPosition,
    getGroupedConversations,
    exportData: () => storage.exportAll(),
    importData: async (json: string) => {
      await storage.importAll(json)
      await loadConversations()
    },
    clearAllData: async () => {
      await storage.clearAll()
      await loadConversations()
    },
  }
}
