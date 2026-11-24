import { describe, it, expect } from 'vitest'
import { splitIntoSentences, SentenceBuffer, isAbbreviation } from './sentence-splitter'

describe('splitIntoSentences', () => {
  it('splits standard sentences ending in periods, exclamations, and questions', () => {
    const text = 'Good morning, sir. All protocols are active! Shall we proceed?'
    const result = splitIntoSentences(text)
    expect(result).toEqual([
      'Good morning, sir.',
      'All protocols are active!',
      'Shall we proceed?',
    ])
  })

  it('handles titles and abbreviations without prematurely splitting', () => {
    const text = 'Dr. Banner contacted Mr. Stark regarding the Mark VII suit.'
    const result = splitIntoSentences(text)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Dr. Banner contacted Mr. Stark regarding the Mark VII suit.')
  })

  it('handles numbers and decimals without splitting', () => {
    const text = 'The thruster efficiency is at 98.6% output. System nominal.'
    const result = splitIntoSentences(text)
    expect(result).toEqual([
      'The thruster efficiency is at 98.6% output.',
      'System nominal.',
    ])
  })

  it('handles newlines as natural sentence boundaries', () => {
    const text = 'Initiating arc reactor.\nPower output steady.\nStanding by.'
    const result = splitIntoSentences(text)
    expect(result).toEqual([
      'Initiating arc reactor.',
      'Power output steady.',
      'Standing by.',
    ])
  })

  it('returns empty array for whitespace or empty string', () => {
    expect(splitIntoSentences('')).toEqual([])
    expect(splitIntoSentences('   \n\t  ')).toEqual([])
  })
})

describe('SentenceBuffer (Streaming SSE)', () => {
  it('buffers partial tokens until a full sentence arrives', () => {
    const buffer = new SentenceBuffer()

    const chunk1 = buffer.push('Good morning, ')
    expect(chunk1).toEqual([])

    const chunk2 = buffer.push('sir. Systems ')
    expect(chunk2).toEqual(['Good morning, sir.'])

    const chunk3 = buffer.push('online!')
    expect(chunk3).toEqual(['Systems online!'])
  })

  it('flushes any remaining partial sentence at stream completion', () => {
    const buffer = new SentenceBuffer()
    buffer.push('Calculating trajectory')
    const remaining = buffer.flush()
    expect(remaining).toEqual(['Calculating trajectory'])
  })

  it('resets buffer correctly', () => {
    const buffer = new SentenceBuffer()
    buffer.push('Partial telemetry')
    buffer.reset()
    expect(buffer.flush()).toEqual([])
  })
})
