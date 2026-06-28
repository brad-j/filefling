# Direct macOS distribution

FileFling is distributed outside the Mac App Store. The release flow uses
`electron-builder` to create a `.dmg` and `.zip`.

## What works without an Apple Developer account

You can build an unsigned app/DMG for local testing:

```bash
pnpm pack:mac
pnpm dist:mac:unsigned
```

Outputs are written to `release/`.

Unsigned builds are useful for testing packaging, icons, startup behavior, and
native dependencies. The unsigned beta scripts apply an ad-hoc code signature so
macOS sees a structurally valid app bundle, but they are **not** a clean end-user
experience: Gatekeeper may still show unidentified-developer/malware-verification
warnings.

## What requires the Apple Developer account

For a clean direct-download experience you need:

- Apple Developer Program membership ($99/year)
- A `Developer ID Application` certificate installed in Keychain
- Notarization credentials

Then build with:

```bash
pnpm dist:mac
```

The notarization hook is `scripts/notarize.cjs`. It automatically skips when
credentials are not present.

## Notarization credentials

Either use Apple ID credentials:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID1234"
pnpm dist:mac
```

Or App Store Connect API key credentials:

```bash
export APPLE_API_KEY="/absolute/path/to/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
pnpm dist:mac
```

## Files involved

- `electron-builder.yml` — packaging config
- `build/icon.icns` — packaged app icon
- `build/entitlements.mac.plist` — hardened runtime entitlements
- `scripts/adhoc-sign-mac.cjs` — ad-hoc signing hook used by unsigned beta builds
- `scripts/notarize.cjs` — notarization hook
- `scripts/generate-icons.mjs` — regenerates tray PNGs and `build/icon.icns`

## Release checklist

Before publishing a public release:

1. Update `version` in `package.json`.
2. Run `pnpm icons:generate` if icon assets changed.
3. Run `pnpm security:audit`.
4. Run `pnpm release:check`.
5. Run `pnpm test:e2e`.
6. Run `pnpm pack:mac` and launch `release/mac*/FileFling.app`.
7. Run `pnpm dist:mac` with signing/notarization credentials.
8. Test the generated DMG on a clean macOS user account or another Mac.
9. Upload the DMG/ZIP to GitHub Releases or your website.

See `docs/security.md` for the detailed testing and security checklist.

## Current product TODOs before broad public release

These are not packaging blockers, but they will matter for non-technical users:

- Consider adding the onboarding test-connection action to Settings for later edits.
- Consider adding an explicit confirmation dialog before trusting a first-seen host key.
- Keep expanding friendly SSH/file error coverage as new real-world failures appear.
- Consider auto-update after the first public release.
