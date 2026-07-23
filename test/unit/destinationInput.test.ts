import { describe, expect, it } from 'vitest'
import { formatDestinationInput, parseDestinationInput } from '../../src/renderer/src/destinationInput'

describe('parseDestinationInput', () => {
  it('accepts a plain IP address', () => {
    expect(parseDestinationInput('100.64.1.2')).toMatchObject({ host: '100.64.1.2', isExeDev: false })
  })

  it('accepts an SSH destination and options', () => {
    expect(parseDestinationInput('ssh -i ~/.ssh/work -p 2222 brad@example.com')).toEqual({
      host: 'example.com',
      username: 'brad',
      port: 2222,
      keyPath: '~/.ssh/work',
      suggestedName: undefined,
      isExeDev: false
    })
  })

  it('configures exe.dev defaults from its HTTPS or SSH hostname', () => {
    expect(parseDestinationInput('https://quiet-river.exe.xyz/')).toEqual({
      host: 'quiet-river.exe.xyz',
      username: 'exedev',
      port: undefined,
      keyPath: undefined,
      suggestedName: 'quiet-river',
      isExeDev: true
    })
  })

  it('accepts host:port shorthand', () => {
    expect(parseDestinationInput('me@box.local:2200')).toMatchObject({
      host: 'box.local',
      username: 'me',
      port: 2200
    })
  })
})

describe('formatDestinationInput', () => {
  it('keeps the common port out of the way', () => {
    expect(formatDestinationInput('box.local', 'me', 22)).toBe('me@box.local')
    expect(formatDestinationInput('box.local', 'me', 2200)).toBe('me@box.local:2200')
  })
})
