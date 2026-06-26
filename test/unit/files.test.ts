import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/main/settings', () => ({
  getSettings: () => ({ screenshotDir: '/tmp' })
}))

import { sanitizeFilename, timestampFilename } from '../../src/main/files'

describe('file naming', () => {
  it('removes unsafe filename characters', () => {
    expect(sanitizeFilename('Screenshot 1: hello/world?.png')).toBe('Screenshot_1__hello_world_.png')
  })

  it('keeps safe filename characters', () => {
    expect(sanitizeFilename('build-log_2026.06.26-alpha.txt')).toBe('build-log_2026.06.26-alpha.txt')
  })

  it('creates timestamp screenshot names while preserving extension', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-25T14:30:15'))

    expect(timestampFilename('anything.jpeg')).toBe('2026-06-25_143015.jpeg')

    vi.useRealTimers()
  })
})
