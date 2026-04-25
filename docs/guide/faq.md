---
title: FAQ
description: Common questions about file formats, limits, and current behavior.
---

# FAQ

## What is `.msep`?

`.msep` is the editable project container used by Motor Sound Editor. It packages project metadata, track definitions, curve data, and referenced audio together so the whole project can be reopened or moved as one unit.

## Which audio formats can I assign to tracks?

The current version supports:

- `wav`
- `ogg`

## Why does the interface show traction, coasting, and brake if only traction and brake curves are editable?

The preview system exposes three simulator states, but the current authoring model stores only dedicated traction and brake curve sets. In the current version, coasting still previews through the traction-side curves.

## Can I preview multiple tracks at the same time?

Yes. As long as a track is audible and has valid audio assigned, the preview engine can play multiple layers together.

## Are hidden tracks still audible?

No. In the current implementation, preview uses only tracks that are enabled, unmuted, and not hidden.

## If I replace a track's audio, does the old file stay in the project forever?

No. Save and Save As clean up unreferenced audio, so replaced files do not keep accumulating inside the `.msep` project.

## Is there a finished settings page?

No. The codebase already has settings storage, but the current user-facing build does not include a finished settings screen.

## Which export targets work right now?

In the current export dialog, only BVE is available. Other targets are visible but cannot be selected.

## Can I rely on export output only and skip saving the `.msep` file?

That is not recommended. `.msep` is the editable source project, while the export package is the delivery artifact. One does not replace the other.
