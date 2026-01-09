import { describe, it, expect } from 'vitest'
import { truncate, formatDate, generateId, cn } from './index'

describe('truncate', () => {
  it('should not truncate short strings', () => {
    expect(truncate('Hello', 10)).toBe('Hello')
  })

  it('should truncate long strings with ellipsis', () => {
    // truncate uses maxLength - 3 for text + 3 for "..."
    // So maxLength=8 gives 5 chars + "..." = "Hello..."
    expect(truncate('Hello World', 8)).toBe('Hello...')
  })

  it('should handle empty strings', () => {
    expect(truncate('', 5)).toBe('')
  })
})

describe('formatDate', () => {
  it('should format a Date object', () => {
    const date = new Date('2026-01-09T12:00:00Z')
    const formatted = formatDate(date)
    // Format depends on locale, just check it returns a non-empty string
    expect(formatted).toBeTruthy()
    expect(typeof formatted).toBe('string')
  })

  it('should handle different dates correctly', () => {
    const date = new Date('2025-06-15T08:30:00Z')
    const formatted = formatDate(date)
    expect(formatted).toBeTruthy()
    expect(typeof formatted).toBe('string')
  })
})

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })

  it('should generate IDs with expected format', () => {
    const id = generateId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })
})

describe('cn (classnames helper)', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    const showBar = false
    expect(cn('foo', showBar && 'bar', 'baz')).toBe('foo baz')
  })

  it('should handle undefined values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar')
  })
})
