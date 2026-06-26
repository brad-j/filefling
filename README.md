# FileFling

FileFling is a macOS menubar app for flinging files — especially screenshots — from your local Mac to a remote machine over SSH/SFTP.

It is built for the workflow of talking to a CLI AI agent on a remote machine via SSH/tmux and needing to quickly share a local screenshot. FileFling uploads the file, copies the remote path to your clipboard, and lets you paste that path straight into the terminal conversation.

## Core workflow

1. Configure one or more SSH destinations.
2. Pick the active destination when needed.
3. Press `⌘⇧F` to send the latest screenshot, or drag a file into the menubar dropdown.
4. FileFling uploads the file over SFTP.
5. The configured clipboard output is copied to your clipboard.
6. Paste the path or prompt into your remote shell, tmux session, or CLI agent chat.

Default pasted value:

```text
/home/brad/shared/2026-06-25_143015.png
```

## Features

- **Menubar-only app** — lives in the macOS menubar, not the dock.
- **Global hotkey** — `⌘⇧F` sends the latest screenshot without opening the dropdown.
- **Latest screenshot preview** — shows a thumbnail, filename, time, and size before sending.
- **Drag & drop upload** — drop a file onto the dropdown to send it.
- **SSH/SFTP transport** — uses the Node `ssh2` library; no external `scp` binary required.
- **First-run onboarding** — guided setup flow for SSH destination details.
- **Connection test upload** — onboarding can run a real test upload and cleanup before finishing setup.
- **SSH config import** — select concrete hosts from `~/.ssh/config` to fill host, user, port, and identity file.
- **Destination profiles** — keep multiple SSH destinations and switch between them from the main view.
- **Clipboard output templates** — copy a raw path, Markdown, or a reusable agent prompt after upload.
- **Auto-copy remote output** — successful sends copy the rendered clipboard template.
- **Send history** — keeps the last 10 sends; search, copy, retry/send again, reveal local files, or delete individual items.
- **TOFU host key verification** — trusts on first use and verifies future connections against stored host key metadata.
- **Host key management** — view trusted host key fingerprints in Settings and forget stale keys after server rebuilds.
- **Friendly error messages** — common SSH/file failures are mapped to actionable messages.
- **Settings UI** — configure host, port, username, SSH key path, remote directory, screenshot directory, and theme.
- **Themes** — Terminal Green, Graphite, and Light.

## First-run onboarding

On first launch, FileFling opens a setup flow instead of dropping users into an empty app.

The onboarding flow can import a concrete host from `~/.ssh/config`, or collect values manually:

- SSH config host alias, optional
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
| Active Destination | Named SSH destination/profile used for sends. |
| SSH Config Host | Optional alias imported from `~/.ssh/config`. |
| Host | SSH host, Tailscale hostname/IP, or server name. |
| Port | SSH port, usually `22`. |
| Username | Remote SSH username. |
| Remote Path | Directory to upload into, e.g. `~/shared`. |
| SSH Key Path | Private key path, e.g. `~/.ssh/id_ed25519`. |
| Screenshot Directory | Local directory scanned for the latest screenshot. |
| Clipboard Template | Text rendered and copied after successful uploads. |
| Theme | App appearance. |

The local app store is typically located at:

```text
~/Library/Application Support/filefling/filefling.json
```

## Destination profiles

FileFling supports multiple named destinations. Each destination stores its own:

- Host
- Port
- Username
- Remote path
- SSH key path
- SSH config alias
- Clipboard template

The active destination is used for hotkey sends, drag-and-drop uploads, test uploads, and history retry/send-again actions. When more than one destination exists, the main view shows a destination picker above the drop zone.

Manage destinations from Settings:

- Rename the active destination.
- Create a new destination copied from the current settings.
- Delete a destination, as long as at least one remains.
- Save connection/clipboard edits back into the active destination.

Existing single-destination installs are migrated into a `Default` profile.

## SSH config support

FileFling can read concrete host aliases from `~/.ssh/config` and included config files.

Supported directives:

- `Host`
- `HostName`
- `User`
- `Port`
- first `IdentityFile`
- `Include`, including simple wildcard includes such as `~/.ssh/conf.d/*.conf`

Example:

```sshconfig
Host devbox
  HostName 100.64.1.2
  User brad
  Port 22
  IdentityFile ~/.ssh/id_ed25519
```

Selecting `devbox` fills the connection fields with the resolved host, username, port, and key path. FileFling still performs uploads through its own `ssh2` transport; advanced OpenSSH options such as `ProxyJump`, `Match`, agent forwarding, and custom `ProxyCommand` are not applied yet.

Wildcard hosts such as `Host *.internal` are ignored in the picker because they are patterns, not concrete destinations.

## Clipboard output templates

By default, FileFling copies the raw remote path:

```text
{{remotePath}}
```

You can customize the copied text in Settings with a template. Supported tokens:

- `{{remotePath}}`
- `{{filename}}`
- `{{host}}`
- `{{username}}`
- `{{timestamp}}`, rendered as an ISO timestamp

Examples:

```text
Look at this screenshot: {{remotePath}}
```

```text
![{{filename}}]({{remotePath}})
```

```text
Please inspect this uploaded file on {{host}}: {{remotePath}}
```

Unknown placeholders are left visible so mistakes are easy to spot. Multiline templates are supported. Send history stores the rendered clipboard text from successful sends, so clicking a history item copies the same output that was copied when the file was originally uploaded.

## Screenshot preview

The main dropdown shows the latest screenshot from the configured screenshot directory before upload.

The preview includes:

- Thumbnail, when macOS can generate one
- Local filename
- Modified time
- File size
- Refresh action

Pressing **Send Previewed Screenshot** uploads the shown file. If no preview is available, FileFling falls back to resolving the latest screenshot at send time.

## History actions

The Recent list stores the last 10 sends with local file metadata when available.

Available actions:

- Click a successful row to copy the rendered clipboard output.
- **Copy raw** copies only the remote path.
- **Retry** retries a failed upload when the original local file is still available.
- **Send again** uploads the same local file again.
- **Reveal** opens the local file in Finder.
- **Delete** removes one history item.
- **Clear** removes all history.
- Search filters by filename, remote path, local path, or error text.

Older history entries created before this feature may not have local path or file size metadata, so retry/reveal may not be available for those items.

## Screenshot and filename behavior

Screenshots sent via hotkey or the **Send Previewed Screenshot** / latest screenshot button are renamed to a clean timestamp:

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
