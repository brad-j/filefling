# FileFling

FileFling is a macOS menubar app for flinging files — especially screenshots — from your local Mac to a remote machine over SSH/SFTP.

It is built for the workflow of talking to a CLI AI agent on a remote machine via SSH/tmux and needing to quickly share a local screenshot. FileFling uploads the file, copies the remote path to your clipboard, and lets you paste that path straight into the terminal conversation.

## Core workflow

1. Configure an SSH destination once.
2. Press `⌘⇧F` to send the latest screenshot, or drag a file into the menubar dropdown.
3. FileFling uploads the file over SFTP.
4. The remote path is copied to your clipboard.
5. Paste the path into your remote shell, tmux session, or CLI agent chat.

Example pasted value:

```text
/home/brad/shared/2026-06-25_143015.png
```

## Features

- **Menubar-only app** — lives in the macOS menubar, not the dock.
- **Global hotkey** — `⌘⇧F` sends the latest screenshot without opening the dropdown.
- **Drag & drop upload** — drop a file onto the dropdown to send it.
- **SSH/SFTP transport** — uses the Node `ssh2` library; no external `scp` binary required.
- **First-run onboarding** — guided setup flow for SSH destination details.
- **Connection test upload** — onboarding can run a real test upload and cleanup before finishing setup.
- **Auto-copy remote path** — successful sends copy the remote path to the clipboard.
- **Send history** — keeps the last 10 sends; click a successful item to copy its path again.
- **TOFU host key verification** — trusts on first use and verifies future connections against stored host key metadata.
- **Host key management** — view trusted host key fingerprints in Settings and forget stale keys after server rebuilds.
- **Friendly error messages** — common SSH/file failures are mapped to actionable messages.
- **Settings UI** — configure host, port, username, SSH key path, remote directory, screenshot directory, and theme.
- **Themes** — Terminal Green, Graphite, and Light.

## First-run onboarding

On first launch, FileFling opens a setup flow instead of dropping users into an empty app.

The onboarding flow collects:

- Host
- Port
- Username
- Remote path
- SSH key path
- Screenshot directory

Then it can run a connection test that:

1. Validates required settings.
2. Connects over SSH.
3. Verifies SSH authentication.
4. Resolves the remote home directory for `~/` paths.
5. Creates the remote directory if needed.
6. Confirms the remote directory is writable.
7. Uploads a tiny hidden `.filefling-test-...txt` file.
8. Removes the test file.

Setup can only be finished after the test succeeds. Users may also choose **Later** to skip onboarding and return through Settings.

Existing installs with complete SSH settings are migrated so onboarding does not unexpectedly reappear.

## Settings

FileFling stores settings locally via `electron-store`.

Main settings:

| Setting | Purpose |
| --- | --- |
| Host | SSH host, Tailscale hostname/IP, or server name. |
| Port | SSH port, usually `22`. |
| Username | Remote SSH username. |
| Remote Path | Directory to upload into, e.g. `~/shared`. |
| SSH Key Path | Private key path, e.g. `~/.ssh/id_ed25519`. |
| Screenshot Directory | Local directory scanned for the latest screenshot. |
| Theme | App appearance. |

The local app store is typically located at:

```text
~/Library/Application Support/filefling/filefling.json
```

## Screenshot and filename behavior

Screenshots sent via hotkey or the **Send Latest Screenshot** button are renamed to a clean timestamp:

```text
2026-06-25_143015.png
```

Dragged files keep their original filename, but unsafe characters are sanitized. For example:

```text
Screenshot 1: hello/world?.png
```

becomes:

```text
Screenshot_1__hello_world_.png
```

Remote paths using `~/` are expanded against the remote user’s home directory before upload.

## Error handling

FileFling maps common low-level SSH/file errors into user-facing messages. Covered cases include:

- Setup required / missing required settings
- Missing SSH key file
- Unreadable SSH key file
- SSH key permissions too open
- Host not found / DNS failure
- Host unreachable
- Connection refused
- Connection timeout
- SSH authentication failure
- Host key mismatch
- Remote path not writable
- Local file missing
- Dropped path is not a file
- No screenshots found
- File too large
- Upload interrupted

The goal is that failures tell users what to fix instead of exposing raw Node/SSH errors.

## Security model

FileFling is a local Electron app that reads user-selected/local screenshot files and uploads them to a user-configured SSH server.

Security measures currently in place:

- SSH host keys are trusted on first use and stored with host, port, algorithm, fingerprint, and trust timestamp.
- Future connections verify the server against the stored host key.
- Host key mismatches produce a clear server-identity warning.
- Trusted host keys can be reviewed and forgotten from Settings.
- Renderer uses `contextIsolation: true`.
- Renderer has `nodeIntegration: false`.
- Renderer sandbox is enabled.
- `window.open` is denied.
- Top-level renderer navigation is restricted.
- Packaged builds ignore `ELECTRON_RENDERER_URL`.
- Content Security Policy is configured in the renderer HTML.
- Preload exposes only a small `window.filefling` API.
- Main-process IPC handlers validate renderer input.
- Remote directories are shell-quoted before `mkdir -p`.
- Uploaded filenames are sanitized.
- Local send paths must be files, not directories.
- Host keys are verified with trust-on-first-use storage and user-visible fingerprint metadata.

See `docs/security.md` for the release security checklist and current security TODOs.

## Stack

- Electron + electron-vite
- React + TypeScript
- Tailwind CSS
- `ssh2` for SSH/SFTP transport
- `menubar` for menubar window behavior
- `electron-store` for local settings/history persistence
- Vitest for unit tests
- Playwright for Electron smoke tests

## Development

Install dependencies:

```bash
pnpm install
```

Run the app in development:

```bash
pnpm dev
```

Typecheck:

```bash
pnpm typecheck
```

Run unit tests:

```bash
pnpm test:unit
```

Run Electron smoke tests:

```bash
pnpm test:e2e
```

Run the release check used before packaging:

```bash
pnpm release:check
```

## Testing onboarding locally

If your local FileFling store already has complete settings and you want to force onboarding to appear again, quit FileFling and set `onboardingComplete` to `false`:

```bash
STORE="$HOME/Library/Application Support/filefling/filefling.json"
cp "$STORE" "$STORE.bak.$(date +%s)"

node - <<'NODE'
const fs = require('fs')
const path = `${process.env.HOME}/Library/Application Support/filefling/filefling.json`
const data = JSON.parse(fs.readFileSync(path, 'utf8'))
data.settings = data.settings || {}
data.settings.onboardingComplete = false
fs.writeFileSync(path, JSON.stringify(data, null, 2))
NODE
```

Then start the dev app:

```bash
pnpm dev
```

If your SSH details are already filled in, onboarding should open at the test step.

## Build

Build the app:

```bash
pnpm build
```

## Package for macOS

Unsigned local app build for testing:

```bash
pnpm pack:mac
```

Unsigned DMG/ZIP for testing direct distribution behavior:

```bash
pnpm dist:mac:unsigned
```

Signed/notarized DMG/ZIP once Apple Developer ID credentials are available:

```bash
pnpm dist:mac
```

See `docs/distribution.md` for the full direct-distribution checklist.

## Tray/app icons

Tray icons are committed as PNG assets under `src/main/icons/`. The packaged app icon is `build/icon.icns`.

If the glyph changes, regenerate icons with:

```bash
pnpm icons:generate
```

## Project docs

- `docs/security.md` — security model, testing checklist, and known security/product TODOs.
- `docs/distribution.md` — direct macOS distribution, signing, notarization, and release checklist.

## License

Proprietary. All rights reserved.

This source code is not licensed for copying, modification, redistribution, or use except with explicit permission from the copyright holder.
