export interface ParsedDestination {
  host: string
  username?: string
  port?: number
  keyPath?: string
  suggestedName?: string
  isExeDev: boolean
}

function shellWords(value: string): string[] {
  return value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((word) =>
    word.replace(/^(['"])(.*)\1$/, '$2')
  ) ?? []
}

function cleanHost(value: string): string {
  return value
    .replace(/^\[|\]$/g, '')
    .replace(/[/:]+$/, '')
    .trim()
}

export function parseDestinationInput(rawValue: string): ParsedDestination | null {
  const raw = rawValue.trim()
  if (!raw) return null

  let username: string | undefined
  let port: number | undefined
  let keyPath: string | undefined
  let destination = raw

  if (/^https?:\/\//i.test(destination)) {
    try {
      const url = new URL(destination)
      // A pasted URL is only a convenient way to supply its hostname. Its
      // port belongs to HTTP, not SSH.
      destination = url.hostname
    } catch {
      return null
    }
  } else {
    const words = shellWords(destination)
    if (words[0]?.toLowerCase() === 'ssh') words.shift()

    let candidate = ''
    for (let index = 0; index < words.length; index += 1) {
      const word = words[index]
      if ((word === '-p' || word === '-i' || word === '-l') && words[index + 1]) {
        const optionValue = words[index + 1]
        if (word === '-p') port = Number(optionValue)
        if (word === '-i') keyPath = optionValue
        if (word === '-l') username = optionValue
        index += 1
        continue
      }
      if (word.startsWith('-p') && word.length > 2) {
        port = Number(word.slice(2))
        continue
      }
      if (word.startsWith('-i') && word.length > 2) {
        keyPath = word.slice(2)
        continue
      }
      if (!word.startsWith('-') && !candidate) candidate = word
    }
    destination = candidate || destination
  }

  const atIndex = destination.lastIndexOf('@')
  if (atIndex > 0) {
    username = destination.slice(0, atIndex)
    destination = destination.slice(atIndex + 1)
  }

  // Accept host:port without confusing an IPv6 address for that shorthand.
  const hostPort = destination.match(/^([^:]+):(\d+)$/)
  if (hostPort) {
    destination = hostPort[1]
    port = Number(hostPort[2])
  }

  const host = cleanHost(destination)
  if (!host || /\s/.test(host)) return null
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) return null

  const isExeDev = host === 'exe.dev' || host.endsWith('.exe.xyz')
  if (isExeDev && host.endsWith('.exe.xyz') && !username) username = 'exedev'

  const firstLabel = host.split('.')[0]
  const suggestedName = isExeDev && host.endsWith('.exe.xyz')
    ? firstLabel
    : undefined

  return { host, username, port, keyPath, suggestedName, isExeDev }
}

export function formatDestinationInput(host: string, username: string, port: number): string {
  if (!host) return ''
  const login = username ? `${username}@${host}` : host
  return port && port !== 22 ? `${login}:${port}` : login
}
