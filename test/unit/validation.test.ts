import { describe, expect, it } from 'vitest'
import { validateSendFileOptions, validateSettingsPatch } from '../../src/main/validation'

describe('IPC validation', () => {
  it('accepts and normalizes safe settings patches', () => {
    expect(validateSettingsPatch({
      host: ' server-name ',
      port: '2222',
      username: 'alice',
      sshConfigHost: 'devbox',
      clipboardTemplate: 'Look: {{remotePath}}',
      activeProfileId: 'work',
      profiles: [{
        id: 'work',
        name: 'Work Devbox',
        host: 'work.example.com',
        port: 22,
        username: 'alice',
        remotePath: '~/shared',
        keyPath: '~/.ssh/id_ed25519',
        sshConfigHost: 'work',
        clipboardTemplate: '{{remotePath}}'
      }],
      theme: 'light',
      onboardingComplete: true,
      ignored: 'value'
    })).toEqual({
      host: 'server-name',
      port: 2222,
      username: 'alice',
      sshConfigHost: 'devbox',
      clipboardTemplate: 'Look: {{remotePath}}',
      activeProfileId: 'work',
      profiles: [{
        id: 'work',
        name: 'Work Devbox',
        host: 'work.example.com',
        port: 22,
        username: 'alice',
        remotePath: '~/shared',
        keyPath: '~/.ssh/id_ed25519',
        sshConfigHost: 'work',
        clipboardTemplate: '{{remotePath}}'
      }],
      theme: 'light',
      onboardingComplete: true
    })
  })

  it('rejects invalid ports and themes', () => {
    expect(() => validateSettingsPatch({ port: 70000 })).toThrow(/port/)
    expect(() => validateSettingsPatch({ theme: 'neon' })).toThrow(/theme/)
    expect(() => validateSettingsPatch({ onboardingComplete: 'yes' })).toThrow(/boolean/)
    expect(() => validateSettingsPatch({ clipboardTemplate: '' })).toThrow(/empty/)
    expect(() => validateSettingsPatch({ profiles: [{ id: 'one', name: 'One', port: 70000 }] })).toThrow(/port/)
    expect(() => validateSettingsPatch({ profiles: [{ id: 'dup', name: 'One' }, { id: 'dup', name: 'Two' }] })).toThrow(/duplicate/)
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
