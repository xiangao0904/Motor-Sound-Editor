---
title: Audio Editor
description: Edit loops, flatten pitch, and reduce selected spectral content.
---

# Audio Editor

Select a track with assigned audio in the project editor and open **Audio Editor**. After editing, click **Save to Project** to replace that track's audio in the project, then save the `.msep` file. Undo and Redo step through audio edits. `Space` plays or pauses the current preview, except while typing in an input field.

## Loop Maker

Drag the waveform's start or end marker, or drag inside the selection to move it. Switch listening between the source, current result, and loop. Zoom in, inspect the edge detail views, and use **Sample Nudge** for final one-sample adjustments. Loop playback continues across the join. Inspect phase and level near both edges to reduce clicks, then apply the result.

## Pitch Flattener

The upper spectrogram shows the current audio; the lower one shows the flattened preview. The yellow path traces the **original pitch contour**. Pick two points on the same visible harmonic ridge and move the endpoints until the path follows it. Choose **Straight** for a line or **Bézier** for a curve with draggable handles. Processing follows the whole path and aims to make the selected pitch contour level.

Adjust the path visually, update the preview, then compare **Current / Result** with **Play** before applying. A path that follows the actual harmonic ridge gives a more reliable correction.

## Spectral Editor

Use **Region** to select a time and frequency area, or **Draw Path** to follow a sound ridge. **Reduction** controls attenuation; **Path width** controls the affected frequency band. Compare Current and Result, remove the last selection or clear all selections, then apply. Start with a modest reduction: nearby wanted frequencies can also be affected.
