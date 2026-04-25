---
title: FAQ
description: Frequently asked questions about the current product state.
---

# FAQ

## What is `.msep`

`.msep` is the current native project format for Motor Sound Editor. It is a ZIP-based container used to preserve:

- project metadata
- tracks and keyframes
- packaged audio assets

Its purpose is to keep a project editable, not to act like the final packaged export deliverable.

## Which audio formats are supported right now

The current track assignment workflow supports:

- `wav`
- `ogg`

## Why do I see other export names in the UI

Because the UI leaves room for future directions, but the only shipped packaged output right now follows the current BVE-style structure used by the app.

## Why is there not a finished settings screen yet

The codebase already contains settings-related state, but the full settings experience is not complete, so the current site should not market it as shipped.

## What usually causes export failure

Typical reasons include:

- no eligible exportable tracks
- missing audio assignments
- invalid or unavailable output path

## Is this meant to be a general-purpose audio workstation

No. It is much closer to a dedicated railway motor sound authoring tool. The focus is:

- project management
- speed-curve editing
- realtime preview
- export-ready project authoring

## What limits should I keep in mind today

- the current source version is still `v0.0.1`
- the product story is Windows-first
- the shipped packaged output is still narrowly scoped
- the settings experience is incomplete
- automated testing coverage is still limited
