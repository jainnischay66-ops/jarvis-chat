import { get, set, del, keys, clear, createStore } from 'idb-keyval'
import type { Conversation, StorageProvider, UIPreferences } from './types'

export const DEFAULT_SYSTEM_PROMPT =
  'You are Jarvis, a personal AI assistant. You are direct, curious, and warm, with a touch of dry humor. You are honest rather than agreeable, and concise by default. You never sound robotic or sycophantic. You reply in whatever language the user writes in.'

export const DEFAULT_PREFERENCES: UIPreferences = {
  theme: 'system',
  sidebarOpen: true,
  temperature: 0.7,
  maxContextMessages: 50,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  readAloud: false,
  provider: 'gemini',
  model: 'gemini-2.0-flash',
}

let customStore: any = null

function getStore() {
  if (typeof window === 'undefined') return null
  if (!customStore) {
    try {
      customStore = createStore('jarvis-db', 'conversations')
    } catch {
      return null
    }
  }
  return customStore
}

export class IndexedDBStorage implements StorageProvider {
  async getConversation(id: string): Promise<Conversation | null> {
    const store = getStore()
    if (!store) return null
    try {
      const conv = await get<Conversation>(id, store)
      return conv || null
    } catch (e) {
      console.warn('Failed to load conversation from IndexedDB:', e)
      return null
    }
  }

  async getAllConversations(): Promise<Conversation[]> {
    const store = getStore()
    if (!store) return []
    try {
      const allKeys = await keys(store)
      const convs: Conversation[] = []
      for (const key of allKeys) {
        try {
          const conv = await get<Conversation>(key, store)
          if (conv && conv.id && conv.title) {
            convs.push(conv)
          }
        } catch {
          // Skip corrupted entries gracefully
        }
      }
      return convs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    } catch (e) {
      console.warn('Failed to get all conversations:', e)
      return []
    }
  }

  async saveConversation(conv: Conversation): Promise<void> {
    const store = getStore()
    if (!store) return
    try {
      await set(conv.id, conv, store)
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded. Please export and clear older chats.')
      }
      console.error('Failed to save conversation:', e)
      throw e
    }
  }

  async deleteConversation(id: string): Promise<void> {
    const store = getStore()
    if (!store) return
    try {
      await del(id, store)
    } catch (e) {
      console.error('Failed to delete conversation:', e)
    }
  }

  async searchConversations(query: string): Promise<Conversation[]> {
    if (!query || !query.trim()) return this.getAllConversations()
    const q = query.toLowerCase()
    const all = await this.getAllConversations()
    return all.filter(c => {
      if (c.title?.toLowerCase().includes(q)) return true
      return c.messages?.some(m => m.content?.toLowerCase().includes(q))
    })
  }

  async exportAll(): Promise<string> {
    const all = await this.getAllConversations()
    return JSON.stringify({ version: 1, exportedAt: Date.now(), conversations: all }, null, 2)
  }

  async importAll(data: string): Promise<void> {
    const store = getStore()
    if (!store) return
    let parsed: any
    try {
      parsed = JSON.parse(data)
    } catch {
      throw new Error('Invalid JSON format.')
    }

    const conversations: Conversation[] = Array.isArray(parsed)
      ? parsed
      : parsed?.conversations || []

    for (const conv of conversations) {
      if (conv && conv.id && conv.title) {
        await set(conv.id, conv, store)
      }
    }
  }

  async clearAll(): Promise<void> {
    const store = getStore()
    if (!store) return
    try {
      await clear(store)
    } catch (e) {
      console.error('Failed to clear storage:', e)
    }
  }
}

export function getUIPreferences(): UIPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const stored = localStorage.getItem('jarvis-preferences')
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
    }
  } catch (e) {
    console.warn('Failed to read UI preferences:', e)
  }
  return DEFAULT_PREFERENCES
}

export function saveUIPreferences(prefs: Partial<UIPreferences>): void {
  if (typeof window === 'undefined') return
  try {
    const current = getUIPreferences()
    const updated = { ...current, ...prefs }
    localStorage.setItem('jarvis-preferences', JSON.stringify(updated))
  } catch (e) {
    console.warn('Failed to save UI preferences:', e)
  }
}
