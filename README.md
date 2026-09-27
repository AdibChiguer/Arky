# Arky

Arky is a free, open-source desktop utility that puts your most-used actions in a fast radial wheel. Create profiles, launch applications, open URLs and files, manage clipboard history, and trigger everything from a global shortcut.

Arky is built with React, TypeScript, Rust, and Tauri. It does not require an account, license key, subscription, or payment.

## Features

- Radial action wheel that opens at your cursor
- Custom actions, folders, nested folders, icons, and quick keys
- Multiple profiles for different workflows or contexts
- Global shortcut recording and configurable wheel behavior
- Application picker with installed-app icons and running-window previews
- Clipboard history for text and images
- Optional launch-at-login and system-tray support
- Import and export of the complete configuration
- Adjustable wheel size and opacity
- Local-first storage with no required cloud service

## Supported platforms

The project targets Windows, macOS, and Linux through Tauri. Platform-specific behavior, such as application discovery and global shortcuts, may vary by operating system.

## Development setup

Install the prerequisites for [Tauri 2](https://v2.tauri.app/start/prerequisites/), including:

- Node.js 20 or newer
- npm
- Rust stable and Cargo
- The native WebView and build dependencies required by your operating system

Then install the JavaScript dependencies and start the desktop app:

```bash
npm install
npm run tauri -- dev
```

For frontend-only development, use:

```bash
npm run dev
```

## Checks and builds

```bash
npm run typecheck
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
```

Build an installable Tauri bundle with:

```bash
npm run tauri -- build
```

## Data and privacy

Arky stores its configuration and clipboard history locally using the operating system's application-data directory. Clipboard history can contain sensitive information, so review and clear it when appropriate. Arky does not require an online account or payment service to run.

Actions may open URLs, files, or applications that you configure yourself. Those actions are performed by your operating system and are outside Arky's control.

## Contributing

Bug reports, feature requests, documentation improvements, and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change.

## Security

Please see [SECURITY.md](SECURITY.md) for reporting security issues. Do not commit API keys, passwords, personal clipboard data, or local environment files.

## License

Arky is released under the [MIT License](LICENSE). Dependencies and bundled assets may have their own licenses; see their respective project notices before redistributing modified bundles.
