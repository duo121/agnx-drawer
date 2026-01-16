---
sidebar_position: 3
---

# Desktop Application

Native desktop apps for Windows, macOS, and Linux.

## Download

Get the latest release from [GitHub Releases](https://github.com/duo121/agnx-drawer/releases).

| Platform | Format |
|----------|--------|
| Windows | `.exe` installer |
| macOS | `.dmg` package |
| Linux | `.AppImage`, `.deb` |

## Features

- **Offline capable**: Works without internet (with local AI like Ollama)
- **Native performance**: Built with Electron/Tauri
- **System integration**: File associations, menu bar
- **Auto-updates**: Automatic update notifications

## Build from Source

### Electron

```bash
# Install dependencies
pnpm install

# Development
pnpm electron:dev

# Build for production
pnpm electron:build
```

### Tauri

```bash
# Install Rust and Tauri prerequisites
# See: https://tauri.app/v1/guides/getting-started/prerequisites

# Development
pnpm tauri:dev

# Build for production
pnpm tauri:build
```

## Configuration

Desktop apps use the same environment variables. Create a `.env` file in the app data directory:

- **Windows**: `%APPDATA%\agnx-drawer\.env`
- **macOS**: `~/Library/Application Support/agnx-drawer/.env`
- **Linux**: `~/.config/agnx-drawer/.env`

## Local AI with Ollama

For fully offline operation:

1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2`
3. Configure in app settings:
   - Provider: Ollama
   - Model: llama3.2
   - URL: http://localhost:11434
