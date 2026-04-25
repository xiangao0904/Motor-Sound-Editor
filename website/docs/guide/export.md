---
title: Export Workflow
description: Native export workflow behavior and packaging notes.
---

# Export Workflow

Motor Sound Editor ships with a structured native export workflow that turns an authored project into a ready-to-test package. The current packaged output is built around the BVE-style folder and file structure used by the app today, while the authoring workflow itself is described here more broadly as the product's export pipeline.

## What makes a track exportable

A track is considered exportable when it is:

- enabled
- not muted
- assigned to an audio asset

If no track satisfies those conditions, export is intentionally blocked.

## Current packaging behavior

- output container: `.zip`
- packaged structure: current BVE-style layout
- accepted source audio: `wav`, `ogg`
- `ogg` is decoded and converted to `wav` during export
- exported WAV encoding: `PCM16`
- selectable sample rates:
  - `22050`
  - `32000`
  - `44100`
  - `48000`
  - `96000`

## Output structure

```text
<ProjectName>.zip
\-- <ProjectName>/
    |-- vehicle.txt
    |-- motornoise/
    |   |-- motornoise.txt
    |   |-- powerfreq.csv
    |   |-- powervol.csv
    |   |-- brakefreq.csv
    |   \-- brakevol.csv
    \-- sound/
        |-- Sound.txt
        |-- sound_1.wav
        |-- sound_2.wav
        \-- ...
```

## What those files do

### `vehicle.txt`

Points the packaged project to `sound\Sound.txt` and `motornoise\motornoise.txt`.

### `motornoise/*.csv`

Stores sampled data derived from the project keyframe curves.

### `Sound.txt`

Maps exported track indices to generated WAV files.

## Practical export advice

- check which tracks are still muted, hidden, or inactive in your workflow
- make sure every track you expect to hear is actually assigned to audio
- remember that OGG inputs become WAV on export, which can change final package size

::: tip Export note
The current packaged output follows the BVE-oriented structure used by the application today. As the export system evolves, this page should remain the source of truth for the formats and package layouts that are actually shipped.
:::
