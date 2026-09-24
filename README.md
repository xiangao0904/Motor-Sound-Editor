# Motor Sound Editor (MSE)

[简体中文](./README.zh-CN.md)

[![Version](https://img.shields.io/badge/version-1.3.0-0078d4?style=flat-square&logo=github)](https://github.com/xiangao0904/Motor-Sound-Editor/releases/tag/v1.3.0)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-brightgreen)
![Tech Stack](https://img.shields.io/badge/stack-Vue3%20|%20Tauri%20|%20Rust-orange)

**Motor Sound Editor** is a desktop editor for creating BVE-style train motor sound projects. It replaces manual CSV editing with visual curve editing, real-time layered preview, portable `.msep` project files, and one-click export for simulator-ready packages.

![EditorPage](./public/editpage2.png)

## Core Features

- **Visual curve editing**: Edit speed-based pitch and volume curves for traction and braking.
- **Multi-track preview**: Preview layered motor sounds while changing speed and simulator state.
- **Portable project files**: Package curve data and audio assets in the `.msep` format.
- **BVE export**: Generate `vehicle.txt`, `motornoise.txt`, CSV tables, and WAV audio.
- **MTR export**: Generate MTR-compatible sound files, `sound.cfg`, CSV tables, and `sounds.json`.
- **Desktop integration**: Supports single-instance behavior and `.msep` file association on Windows and macOS.

## Download and Installation

Download the package for your platform from the [Releases](https://github.com/xiangao0904/Motor-Sound-Editor/releases) page. The macOS Universal package supports both Apple Silicon and Intel Macs. Open the DMG and drag **Motor Sound Editor** into the Applications folder.

### macOS security notice

The current macOS package uses an ad-hoc signature and has not been signed with an Apple Developer ID or notarized by Apple. macOS may therefore report that the developer cannot be verified or that the app is damaged.

Only continue after confirming that the package came from this repository's official Releases page. First try opening the app once, then go to **System Settings → Privacy & Security** and choose **Open Anyway**. If macOS still blocks it, run:

```bash
xattr -dr com.apple.quarantine "/Applications/Motor Sound Editor.app"
open "/Applications/Motor Sound Editor.app"
```

This command removes the download quarantine attribute from this app only. It does not disable Gatekeeper globally.

## Development

### Prerequisites

- Node.js
- pnpm
- Rust toolchain
- Tauri build dependencies for the target platform

### Commands

```bash
pnpm install
pnpm tauri dev
pnpm build
pnpm tauri build
```


## Project Format

`.msep` files are zip-based project archives. They contain project metadata, track and curve data, and packaged audio assets, so projects can be moved between machines without losing referenced audio.

## License

This project is released under the MIT License.
