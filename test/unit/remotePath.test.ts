import { describe, expect, it } from 'vitest'
import { expandRemoteDir, joinRemotePath, shellQuote, stripTrailingSlash } from '../../src/main/remotePath'

describe('remote path helpers', () => {
  it('quotes shell values safely', () => {
    expect(shellQuote('/tmp/simple')).toBe("'/tmp/simple'")
    expect(shellQuote("/tmp/it's fine")).toBe("'/tmp/it'\\''s fine'")
  })

  it('strips trailing slashes without destroying root', () => {
    expect(stripTrailingSlash('/tmp/uploads///')).toBe('/tmp/uploads')
    expect(stripTrailingSlash('/')).toBe('/')
  })

  it('expands tilde paths against remote home', () => {
    expect(expandRemoteDir('~/shared', '/home/alice')).toBe('/home/alice/shared')
    expect(expandRemoteDir('~', '/home/alice')).toBe('/home/alice')
    expect(expandRemoteDir('/srv/shared/', '/home/alice')).toBe('/srv/shared')
  })

  it('joins remote paths with a single slash', () => {
    expect(joinRemotePath('/srv/shared/', 'file.png')).toBe('/srv/shared/file.png')
  })
})
