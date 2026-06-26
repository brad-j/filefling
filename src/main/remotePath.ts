export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function stripTrailingSlash(value: string): string {
  return value.length > 1 ? value.replace(/\/+$/, '') : value
}

export function expandRemoteDir(remoteDir: string, homeDir: string): string {
  const trimmed = stripTrailingSlash(remoteDir.trim())
  if (trimmed === '~') return homeDir
  if (trimmed.startsWith('~/')) return `${homeDir}/${trimmed.slice(2)}`
  return trimmed
}

export function joinRemotePath(remoteDir: string, remoteFilename: string): string {
  return `${stripTrailingSlash(remoteDir)}/${remoteFilename}`
}
