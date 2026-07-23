# FileFling

FileFling is a macOS menubar app for flinging files — especially screenshots — from your local Mac to a remote machine over SSH/SFTP.

It is built for the workflow of talking to a CLI AI agent on a remote machine via SSH/tmux and needing to quickly share a local screenshot. FileFling uploads the file, copies the remote path to your clipboard, and lets you paste that path straight into the terminal conversation.

## Core workflow

1. Paste an IP, hostname, or SSH command, such as `ssh me@server.local`.
2. Optionally give the destination a name, then click **Save destination**.
3. Press `⌘⇧F` to send the latest screenshot, or drop any file into the menubar dropdown.
4. FileFling uploads over SFTP and copies the remote path to the clipboard.
5. Paste the path into your remote shell, tmux session, or CLI agent chat.

The common settings are inferred: port `22`, `~/shared`, the current macOS username, and the first standard private key found in `~/.ssh`. They remain editable under **Connection details**.

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
- **One-field setup** — paste an IP, hostname, `user@host`, HTTPS hostname, or complete `ssh …` command.
- **Optional connection test** — run a real test upload and cleanup without blocking setup.
- **SSH config import** — select concrete hosts from `~/.ssh/config` to fill host, user, port, and identity file.
- **Destination profiles** — keep multiple SSH destinations and switch between them from the main view.
- **Clipboard output templates** — copy a raw path, Markdown, or a reusable agent prompt after upload.
- **Auto-copy remote output** — successful sends copy the rendered clipboard template.
- **Compact send history** — keeps the last 10 sends and lets you copy a recent result again.
- **TOFU host key verification** — trusts on first use and verifies future connections against stored host key metadata.
- **Host key management** — view trusted host key fingerprints in Settings and forget stale keys after server rebuilds.
- **Friendly error messages** — common SSH/file failures are mapped to actionable messages.
- **Settings UI** — configure host, port, username, SSH key path, remote directory, screenshot directory, and theme.
- **Themes** — Terminal Green, Graphite, and Light.

## First-run setup

On first launch, FileFling asks one question: **Where should files go?** Paste any of these:

```text
100.64.1.2
me@server.local
server.local:2222
ssh -i ~/.ssh/work -p 2222 me@server.local
https://my-vm.exe.xyz/
```

A name is optional. Port, username, upload folder, and SSH key are available under **Connection details**, but the defaults should work for a typical key-based SSH setup. Hosts from `~/.ssh/config` are suggested in the server field.

**Test** is optional. It verifies authentication, creates the remote directory if needed, uploads a tiny temporary file, and removes it. **Save destination** is enough to finish setup.

## Settings

FileFling stores settings locally via `electron-store`.

Main settings:

| Setting | Purpose |
| --- | --- |
| Server | IP, hostname, `user@host`, SSH command, or HTTPS hostname. |
| Name | Optional label used when switching destinations. |
| Connection details | Username, SSH port, remote upload folder, and private key. |
| Screenshot folder | Local directory scanned for the latest screenshot. |
| Copied text | Template rendered and copied after successful uploads. |
| Appearance | Dark, Light, or Terminal. |

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

The active destination is used for hotkey sends, drag-and-drop uploads, and test uploads. When more than one destination exists, the main view shows a destination picker above the send card.

Manage destinations from Settings with **Add another** and **Remove this destination**. When multiple destinations exist, the main view shows a compact destination picker.

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

## exe.dev

[exe.dev](https://exe.dev/docs/what-is-exe) VMs work as standard SSH destinations. Create or list your VMs from Terminal, then paste the VM hostname into FileFling:

```bash
ssh exe.dev
ssh exe.dev ls --json
```

```text
my-vm.exe.xyz
```

FileFling recognizes `*.exe.xyz` and defaults to:

- Host: `my-vm.exe.xyz`
- Username: `exedev`
- Port: `22`
- Upload folder: `~/shared`
- SSH key: the first standard local key, or the key supplied in a pasted `ssh -i …` command

exe.dev must know that key. If needed, add it with the exe.dev web UI or CLI. When several local keys exist, paste the exact working command, for example:

```text
ssh -i ~/.ssh/id_ed25519_exe my-vm.exe.xyz
```

The VM's HTTPS front door is separate from SSH file storage. `https://my-vm.exe.xyz/` proxies to a web server running on the VM; it does not automatically expose `~/shared`. To produce browser URLs for uploads:

1. Run a web server rooted at `~/shared` on the VM, for example on port `8000`.
2. Point the exe.dev proxy at it with `ssh exe.dev share port my-vm 8000`.
3. Set FileFling's **Copied text** preference to `https://my-vm.exe.xyz/{{filename}}`.

exe.dev HTTPS proxies are private by default. Use `ssh exe.dev share set-public my-vm` only when uploaded files should be public. See the [exe.dev proxy documentation](https://exe.dev/docs/proxy) for access and port details.

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

The preview includes a thumbnail, local filename, and file size. Pressing **Send screenshot** uploads that file. If no preview is available, FileFling resolves the latest screenshot at send time.

## Recent sends

The collapsed **Recent** list stores the last 10 sends. Open it and click a successful row to copy the same rendered clipboard output again. Failed sends remain visible, and **Clear recent** removes the list.

## Screenshot and filename behavior

Screenshots sent via hotkey or the **Send screenshot** button are renamed to a clean timestamp:

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

The one-page destination setup will open with any existing details prefilled.

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
