---
title: Getting Started
description: First-run guidance for Motor Sound Editor users.
---

# Getting Started

Motor Sound Editor is built for creators who want to design layered motor sound projects in a visual editor instead of hand-maintaining raw simulator tables. The current version is focused on three core workflows already implemented in the desktop app: project authoring, real-time preview, and export packaging.

![Motor Sound Editor home screen](/homepage.png)

## 1. Preparation

### Operating system

**Windows** is the primary supported platform today.

### Download and install

- **Get the app**: Download the current Windows installer directly from [this release link](https://github.com/xiangao0904/Motor-Sound-Editor/releases/download/v1.0.0/Motor.Sound.Editor_1.0.0_x64-setup.exe).
- **Quick install**: After downloading, run the installer. No extra runtime setup is required because the Tauri dependencies are already bundled with the app.

### Example files

If you want working `.msep` projects to inspect right away, start with these examples:

- [caf_train_sound.msep](https://github.com/xiangao0904/Motor-Sound-Editor/releases/download/v1.0.0/caf_train_sound.msep) — Contributor: K.L1
- [class323.msep](https://github.com/xiangao0904/Motor-Sound-Editor/releases/download/v1.0.0/class323.msep) — Contributor: LX9702

### Data and assets

- **Assets**: Pepare at least one motor sound source file in `.wav` or `.ogg`.
- **Parameters**: Prepare the train's basic performance values, such as maximum speed, acceleration, and brake deceleration.

## 2. Core workflow

You can experience the main features of the app through these six steps:

### Step 1: Create a project

![New project](/docs/newproject.png)

1. Launch the app and click **New Project** on the Home screen.
2. Enter a project name such as `MyTrainMotor`.
3. Set defaults such as **Max Speed** and **Acceleration**.
4. Confirm and enter the editor.

### Step 2: Manage tracks and import audio

![Import audio](/docs/importaudio.png)

1. In **Track Layers**, make sure there is an active track.
2. In **Track Details**, click the file picker icon.
3. Choose a `.wav` or `.ogg` audio file.

### Step 3: Draw pitch and volume curves

![Draw curves](/docs/trackline.png)

1. Switch to **Keyframe** mode in the toolbar.
2. Add keyframes for **Traction Pitch** and **Traction Volume** in the chart. Left click adds a point and right click removes one.
3. For finer control, switch to **Move** mode to drag keyframes or edit values directly in **List Editor**.

### Step 4: Preview in real time

![Real-time preview](/docs/rt-preview.png)

1. Press `Space` to start playback.
2. Use `W` to move the state toward traction and `S` to move it toward brake.
3. Adjust **Current Speed**, or switch to **Select** mode and click empty space in the chart to change preview speed quickly.

### Step 5: Save the project

- Press `Ctrl+S` to save the project as `.msep`.
- `.msep` is the app's native project format. It packages project settings, curve data, and audio assets together so the project stays portable and editable.

### Step 6: Export a BVE package

![Export](/docs/output.png)

1. Click **Export** in the toolbar or menu.
2. Choose **BVE** in the dialog.
3. Select a sample rate, usually `44100 Hz`.
4. The app generates a `.zip` package containing the required BVE files such as `vehicle.txt`, `motornoise.txt`, and converted WAV audio.

## 3. Common shortcuts

A small set of shortcuts already covers most of the daily editing loop:

| Shortcut | Action |
| :--- | :--- |
| **Space** | Play / pause preview |
| **W** | Move the state toward traction |
| **S** | Move the state toward brake |
| **Ctrl+S** | Save the project |
| **Ctrl+Z / Ctrl+Y** | Undo / redo |
| **Delete** | Delete the selected keyframe |
