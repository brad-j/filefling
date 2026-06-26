import { describe, expect, it } from 'vitest'
import { validateSendFileOptions, validateSettingsPatch } from '../../src/main/validation'

describe('IPC validation', () => {
  it('accepts and normalizes safe settings patches', () => {
    expect(validateSettingsPatch({
      host: ' server-name ',
      port: '2222',
      username: 'alice',
      theme: 'light',
      ignored: 'value'
    })).toEqual({
      host: 'server-name',
      port: 2222,
      username: 'alice',
      theme: 'light'
    })
  })

  it('rejects invalid ports and themes', () => {
    expect(() => validateSettingsPatch({ port: 70000 })).toThrow(/port/)
    expect(() => validateSettingsPatch({ theme: 'neon' })).toThrow(/theme/)
  })

  it('rejects null bytes in string settings', () => {
    expect(() => validateSettingsPatch({ host: 'server\0name' })).toThrow(/null bytes/)
  })

  it('accepts send file options', () => {
    expect(validateSendFileOptions({ filePath: ' /tmp/file.png ', isScreenshot: false })).toEqual({
      filePath: '/tmp/file.png',
      isScreenshot: false
    })
  })

  it('rejects malformed send file options', () => {
    expect(() => validateSendFileOptions(null)).toThrow(/object/)
    expect(() => validateSendFileOptions({ isScreenshot: 'yes' })).toThrow(/boolean/)
  })
})
