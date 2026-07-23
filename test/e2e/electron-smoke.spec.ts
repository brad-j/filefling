import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'

let app: ElectronApplication | undefined

test.afterEach(async () => {
  await app?.close().catch(() => undefined)
  app = undefined
})

test('boots the Electron app with a constrained renderer bridge', async () => {
  app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true'
    }
  })

  const page = await app.firstWindow({ timeout: 15_000 })
  await page.waitForLoadState('domcontentloaded')

  await expect(page.getByRole('heading', { name: 'FileFling' })).toBeAttached()

  const rendererSecurity = await page.evaluate(() => ({
    hasBridge: typeof window.filefling === 'object',
    hasRequire: typeof (window as unknown as { require?: unknown }).require !== 'undefined',
    hasNodeProcess: typeof (window as unknown as { process?: unknown }).process !== 'undefined'
  }))

  expect(rendererSecurity).toEqual({
    hasBridge: true,
    hasRequire: false,
    hasNodeProcess: false
  })

  const mainState = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    return {
      url: window?.webContents.getURL(),
      windowCount: BrowserWindow.getAllWindows().length
    }
  })

  expect(mainState.windowCount).toBeGreaterThanOrEqual(1)
  expect(mainState.url).toContain('/out/renderer/index.html')
})
