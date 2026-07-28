# Outpost desktop (Tauri shell)

Thin macOS desktop shell that loads the Outpost studio CRM in a native window.

- Starts on a local black splash (`desktop/splash`), then navigates to the CRM
- **Dev:** `http://localhost:3000` (run Next.js separately)
- **Release:** `https://admin.timblazic.dev`
- Client portal stays in the browser; external links open with the system browser

## Prerequisites

- macOS 11+
- [Xcode Command Line Tools](https://developer.apple.com/xcode/) (`xcode-select --install`)
- [Rust](https://rustup.rs/) (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Node 20+ (same as the web app)

## Develop

From the repo root (with `npm run dev` already serving the web app):

```bash
npm run desktop:dev
```

Or from this folder:

```bash
npm install
npm run dev
```

Log in as usual. Server actions hit your local Next server.

## Build (unsigned `.app` / `.dmg`)

```bash
npm run desktop:build
```

Artifacts:

- `desktop/src-tauri/target/release/bundle/macos/Outpost.app`
- `desktop/src-tauri/target/release/bundle/dmg/Outpost_*.dmg`

## Sign + notarize (Gatekeeper)

Requires an [Apple Developer](https://developer.apple.com) account and a Developer ID Application certificate in Keychain.

```bash
# Identity example — list with: security find-identity -v -p codesigning
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"   # appleid.apple.com → App-specific passwords
export APPLE_TEAM_ID="TEAMID"

cd desktop
npm run build -- --config '{"bundle":{"macOS":{"signingIdentity":"Env:APPLE_SIGNING_IDENTITY"}}}'
```

Or set signing in `src-tauri/tauri.conf.json` → `bundle.macOS`:

```json
"macOS": {
  "minimumSystemVersion": "11.0",
  "signingIdentity": "Developer ID Application: Your Name (TEAMID)",
  "entitlements": null
}
```

Then notarize the `.dmg` / `.app` with `xcrun notarytool` and staple:

```bash
xcrun notarytool submit path/to/Outpost.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

xcrun stapler staple path/to/Outpost.dmg
```

Without notarization, macOS will warn on first open (right-click → Open still works for local use).

## Menus

- **View → Reload** (`⌘R`)
- **View → Open in Browser** (`⌘⇧O`) — current page in Safari/Chrome

## Icon

Source art: `app-icon.png`. Regenerate bundle icons:

```bash
npm run icon
```
