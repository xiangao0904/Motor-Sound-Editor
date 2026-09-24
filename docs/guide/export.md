---
title: Export Workflow
description: Export motor sound projects for BVE, OpenBVE, and MTR.
---

# Export Workflow

Open **Export Package** from the editor or a project card, choose a format and sample rate, then save the ZIP archive.

## Included tracks

Export includes tracks that are enabled, unmuted, and assigned audio. At least one such track is required. Hiding a track in the editor does not exclude it from export.

## Package formats

| Format | Main files | Purpose |
| --- | --- | --- |
| BVE | `vehicle.txt`, `motornoise/motornoise.txt`, four CSV tables, `sound/Sound.txt`, WAV | BVE motor sound data |
| OpenBVE | `train.dat`, `sound.cfg`, `motor0.wav`, etc. | OpenBVE `train.dat` motor sound tables |
| MTR | `sounds.json`, `sound.cfg`, four CSV tables, OGG | MTR sound resources |

OpenBVE uses `#MOTOR_P1`, `#MOTOR_P2`, `#MOTOR_B1`, and `#MOTOR_B2` in `train.dat`. Each row covers a 0.2 km/h speed step and contains a sound index, pitch, and volume. The `[Motor]` section in `sound.cfg` maps indices to WAV files. See the [official train.dat reference](https://openbve-project.net/documentation_hugo/en/trains/train_dat.html) and [sound.cfg reference](https://openbve-project.net/documentation_hugo/en/trains/sound_cfg.html).

OpenBVE has two simultaneous motor sound slots for traction and two for braking. Export checks active tracks at every speed step and reports the speed if more than two are audible in either mode. Tracks may alternate across speed ranges. Project pitch multipliers are written as percentages (`×100`); project volumes are written on the nominal 128 scale. OpenBVE's effective loudness also depends on train performance parameters.

The exported `train.dat` contains default vehicle parameters so the file can be parsed. Review acceleration, braking, car, and cab settings against your actual train before use. For an existing train, merge the four `#MOTOR_*` sections, `sound.cfg` motor entries, and WAV files into its folder.

## Audio options

Available sample rates are `22050`, `32000`, `44100`, `48000`, and `96000 Hz`; the default is `44100 Hz`. BVE and OpenBVE export WAV and convert OGG sources automatically. MTR exports OGG and offers attenuation distances of `16`, `32`, or `64`.

Keep the `.msep` file to continue editing later.
