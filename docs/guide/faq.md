---
title: FAQ
description: Find answers about project formats, editor limits, playback behavior, and export capabilities in Motor Sound Editor.
---

# FAQ

## What is `.msep`?

`.msep` is the editable project container used by Motor Sound Editor. It packages project metadata, track definitions, curve data, and referenced audio together so the whole project can be reopened or moved as one unit.

## Which audio formats can I assign to tracks?

Supported formats:

- `wav`
- `ogg`

## Why does the interface show traction, coasting, and brake if only traction and brake curves are editable?

The preview system offers three simulator states. The project stores traction and brake curve sets, and coasting previews through the traction curves.

## Can I preview multiple tracks at the same time?

Yes. As long as a track is audible and has valid audio assigned, the preview engine can play multiple layers together.

## Are hidden tracks still audible?

No. In the current implementation, preview uses only tracks that are enabled, unmuted, and not hidden.

## If I replace a track's audio, does the old file stay in the project forever?

No. Save and Save As clean up unreferenced audio, so replaced files do not keep accumulating inside the `.msep` project.

## Which settings can I change?

Settings on the Home screen includes language, keyframe snapping steps, and chart grid line counts.

## Which export targets work right now?

The app exports BVE, MTR, and OpenBVE formats. OpenBVE packages contain `train.dat`, `sound.cfg`, and WAV files, with at most two audible tracks per speed and mode. See [Export Workflow](/docs/guide/export).

## Does `train.dat` import preserve vehicle parameters?

It imports the motor sound tables and audio. Acceleration and other train parameters are not preserved in the editable project. The exported `train.dat` uses defaults that should be checked before use.

## Can I rely on export output only and skip saving the `.msep` file?

That is not recommended. `.msep` is the editable source project, while the export package is the delivery artifact. One does not replace the other.
