---
title: For Developers
description: Developer-oriented entry points for understanding Motor Sound Editor architecture, data flow, and contribution-focused code reading.
---

# For Developers

Project curve editing and source audio processing live on separate pages. The frontend parses OpenBVE `train.dat` imports; Rust builds the export ZIP and audio files.

If you want to understand the current implementation path, start here:

- `src/App.vue`: app-level flow and page switching.
- `src/pages/HomePage.vue`: project creation, opening, and import logic on the Home screen.
- `src/pages/EditorPage.vue`: the editor workspace, list editor, and project details dialog.
- `src/services/audioPreview.ts`: real-time preview logic.
- `src/pages/AudioEditorPage.vue` and `src/pages/SpectralEditorPanel.vue`: loop, pitch, and spectral tools.
- `src/services/projectImport.ts`: BVE, MTR, and OpenBVE import.
- `src/services/projectExport.ts`, `src/services/nativeInterop.ts`, and `src-tauri/src/native.rs`: export checks, Tauri calls, and packaging.
