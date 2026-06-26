# Security and testing checklist

Fling is a local Electron app that reads files from disk and sends them to a user-configured SSH server. The main public-release risks are renderer compromise, unsafe IPC input, SSH path handling, stale Electron vulnerabilities, and accidentally shipping personal defaults.

## Required release checks

Run these before every public release:

```bash
pnpm security:audit
pnpm release:check
pnpm test:e2e
pnpm dist:mac
```

For unsigned local packaging tests:

```bash
pnpm dist:mac:unsigned
```

## Test layers

### Unit tests: Vitest

Unit tests live in `test/unit` and cover logic that should not require Electron:

- filename sanitization and screenshot naming
- remote path expansion and shell quoting
- IPC input validation for settings and send requests

Run:

```bash
pnpm test:unit
```

### Electron smoke tests: Playwright

Playwright is used for a small Electron smoke suite in `test/e2e`.

It verifies that:

- the built app boots
- the preload bridge exists
- `require` is not exposed to the renderer
- `process` is not exposed to the renderer
- the renderer loads from the built `out/renderer/index.html`

Run:

```bash
pnpm test:e2e
```

Do not put all business-logic coverage in Playwright. Use it for high-value app boot/security checks; keep logic coverage in Vitest.

## Electron hardening in place

Main window preferences:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`

Navigation hardening:

- `window.open` is denied
- top-level navigation is blocked unless it is the app renderer URL
- packaged builds ignore `ELECTRON_RENDERER_URL`, so environment variables cannot redirect the app to a remote renderer

Renderer hardening:

- Content Security Policy in `src/renderer/index.html`
- preload exposes only a small `window.fling` API
- main-process IPC handlers validate renderer input

## SSH/path handling in place

- remote directories are shell-quoted before `mkdir -p`
- `~/` remote paths are expanded before SFTP upload
- uploaded filenames are sanitized
- local send paths are checked to be files, not directories
- host keys are verified with TOFU storage

## Known product/security TODOs

These should be handled before a broad launch, even if they are not blockers for a small beta:

- Add a first-run setup flow instead of relying on Settings discovery.
- Add an explicit “Test connection” button.
- Improve UX for first-time host-key trust and host-key mismatch.
- Consider storing host-key metadata with algorithm/fingerprint for better user-facing warnings.
- Keep Electron patched; `pnpm security:audit` must pass before release.
- Revisit macOS entitlements after signing. Keep them as narrow as possible while still supporting Electron and native modules.
