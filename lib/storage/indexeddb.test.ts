import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Conversation } from './types'

// Mock idb-keyval in-memory
const mockStore = new Map<string, any>()

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => ({})),
  get: vi.fn(async (key: string) => mockStore.get(key)),
  set: vi.fn(async (key: string, val: any) => mockStore.set(key, val)),
  del: vi.fn(async (key: string) => mockStore.delete(key)),
  keys: vi.fn(async () => Array.from(mockStore.keys())),
  clear: vi.fn(async () => mockStore.clear()),
}))

import { IndexedDBStorage, getUIPreferences, saveUIPreferences } from './indexeddb'

describe('IndexedDBStorage', () => {
  let storage: IndexedDBStorage

  beforeEach(() => {
    mockStore.clear()
    storage = new IndexedDBStorage()
  })

  it('saves and retrieves a conversation', async () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'First Chat',
      messages: [{ id: 'm1', role: 'user', content: 'Hello', createdAt: 100 }],
      createdAt: 100,
      updatedAt: 100,
    }

    await storage.saveConversation(conv)
    const loaded = await storage.getConversation('c1')
    expect(loaded).toEqual(conv)
  })

  it('lists all conversations sorted by updatedAt descending', async () => {
    const c1: Conversation = { id: '1', title: 'Older', messages: [], createdAt: 10, updatedAt: 10 }
    const c2: Conversation = { id: '2', title: 'Newer', messages: [], createdAt: 20, updatedAt: 20 }

    await storage.saveConversation(c1)
    await storage.saveConversation(c2)

    const all = await storage.getAllConversations()
    expect(all.length).toBe(2)
    expect(all[0].id).toBe('2')
    expect(all[1].id).toBe('1')
  })

  it('searches conversations by title and message content', async () => {
    const c1: Conversation = {
      id: '1',
      title: 'Quantum Physics',
      messages: [{ id: 'm1', role: 'user', content: 'What is entanglement?', createdAt: 1 }],
      createdAt: 1,
      updatedAt: 1,
    }
    const c2: Conversation = {
      id: '2',
      title: 'Recipes',
      messages: [{ id: 'm2', role: 'user', content: 'How to bake sourdough?', createdAt: 2 }],
      createdAt: 2,
      updatedAt: 2,
    }

    await storage.saveConversation(c1)
    await storage.saveConversation(c2)

    const res1 = await storage.searchConversations('quantum')
    expect(res1.length).toBe(1)
    expect(res1[0].id).toBe('1')

    const res2 = await storage.searchConversations('sourdough')
    expect(res2.length).toBe(1)
    expect(res2[0].id).toBe('2')
  })

  it('exports and imports all conversations without corruption', async () => {
    const c1: Conversation = { id: '1', title: 'Test 1', messages: [], createdAt: 1, updatedAt: 1 }
    await storage.saveConversation(c1)

    const exported = await storage.exportAll()
    expect(exported).toContain('Test 1')

    mockStore.clear()
    expect(await storage.getAllConversations()).toHaveLength(0)

    await storage.importAll(exported)
    const reloaded = await storage.getAllConversations()
    expect(reloaded).toHaveLength(1)
    expect(reloaded[0].title).toBe('Test 1')
  })

  it('persists and retrieves UI preferences', () => {
    saveUIPreferences({ theme: 'dark', temperature: 0.9 })
    const prefs = getUIPreferences()
    expect(prefs.theme).toBe('dark')
    expect(prefs.temperature).toBe(0.9)
  })
})
