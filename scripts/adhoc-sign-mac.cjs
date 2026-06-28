const { execFileSync } = require('node:child_process')
const path = require('node:path')

module.exports = async function adhocSignMacBuild(context) {
  if (process.platform !== 'darwin') return
  if (process.env.FILEFLING_ADHOC_SIGN !== 'true') return
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  const entitlementsPath = path.join(context.packager.projectDir, 'build', 'entitlements.mac.plist')

  console.log(`[adhoc-sign] signing ${appPath}`)

  execFileSync('codesign', [
    '--force',
    '--deep',
    '--sign',
    '-',
    '--options',
    'runtime',
    '--entitlements',
    entitlementsPath,
    appPath
  ], { stdio: 'inherit' })

  execFileSync('codesign', [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=2',
    appPath
  ], { stdio: 'inherit' })
}
