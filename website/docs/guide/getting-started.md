---
title: Quick Start
description: Quick start for Motor Sound Editor.
---

# Quick Start

Motor Sound Editor is a desktop editor focused on one job: building, previewing, saving, and exporting layered railway motor sound projects without forcing creators to hand-edit raw BVE tables all day.

## Who it is for

- BVE content creators
- Authors working with traction and brake sound layers
- Tool builders who want a project-based desktop workflow instead of loose CSV and text files

## Current product state

| Item | Current state |
| --- | --- |
| Source version | `v0.0.1` |
| Primary target | Windows-first desktop workflow |
| Native project format | `.msep` |
| Export system | Native packaged workflow |
| Not shipped yet | OpenBVE / MTR export, completed settings experience |

## Local development commands

### Desktop app

```bash
pnpm install
pnpm tauri dev
```

### Website and docs

```bash
pnpm site:dev
pnpm site:build
pnpm site:preview
```

## Core workflow

1. Create a new `.msep` project or open an existing one.
2. Enter the editor and choose the active track.
3. Assign a `wav` or `ogg` audio file.
4. Edit traction / brake pitch and volume curves.
5. Preview the current result by changing speed and simulator mode.
6. Save the editable project.
7. Export a packaged build when you need distributable output.

## Useful shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / pause preview |
| `W` | Step simulator mode upward toward `Traction` |
| `S` | Step simulator mode downward toward `Brake` |
| `Ctrl+S` | Save project |
| `Ctrl+Shift+S` | Save project as |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo |
| `Ctrl+D` | Clear active selection |
| `Delete` | Delete the selected keyframe |

::: tip Product boundary
The current product story should stay disciplined. The app already covers project management, curve editing, layered preview, and a shipped export workflow, but it should not be presented as if broader export ecosystems or a complete settings workflow are already done.
:::
