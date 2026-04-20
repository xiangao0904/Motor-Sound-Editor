import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { clamp } from "@/utils/math";

import type { ID } from "@/types/common";
import type { CreateProjectPayload, ProjectDocument } from "@/types/project";
import type { AudioAsset, CurveKind, Keyframe, Track } from "@/types/track";
import { createDefaultTrack, createProjectDocument } from "@/types/factories";

function normalizeSpeed(speed: number, maxSpeed: number): number {
  return clamp(speed, 0, maxSpeed);
}

function normalizeKeyframeValue(kind: CurveKind, value: number): number {
  if (kind === "volume") {
    return clamp(value, 0, 1);
  }

  return clamp(value, 0, 4);
}

function sortKeyframesBySpeed(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.speed - b.speed);
}

function getCurveByKind(track: Track, kind: CurveKind) {
  return kind === "pitch" ? track.pitchCurve : track.volumeCurve;
}

export const useProjectStore = defineStore("project", () => {
  const document = ref<ProjectDocument | null>(null);
  const currentFilePath = ref<string | null>(null);
  const dirty = ref(false);

  const hasProject = computed(() => document.value !== null);

  const meta = computed(() => document.value?.project.meta ?? null);
  const tracks = computed(() => document.value?.tracks.tracks ?? []);
  const assets = computed(() => document.value?.tracks.assets ?? []);
  const activeTrackId = computed(
    () => document.value?.tracks.activeTrackId ?? null,
  );

  const activeTrack = computed(() => {
    if (!document.value) return null;
    return (
      document.value.tracks.tracks.find(
        (track) => track.id === document.value?.tracks.activeTrackId,
      ) ?? null
    );
  });

  function markDirty() {
    if (!document.value) return;
    document.value.project.meta.updatedAt = new Date().toISOString();
    dirty.value = true;
  }

  function clearProject() {
    document.value = null;
    currentFilePath.value = null;
    dirty.value = false;
  }

  function loadProject(next: ProjectDocument, filePath?: string) {
    document.value = next;
    currentFilePath.value = filePath ?? null;
    dirty.value = false;
  }

  function createNewProject(payload: CreateProjectPayload) {
    const next = createProjectDocument(payload);
    document.value = next;
    currentFilePath.value = null;
    dirty.value = false;
  }

  function setProjectFilePath(filePath: string | null) {
    currentFilePath.value = filePath;
  }

  function setProjectMeta(
    patch: Partial<
      Pick<
        ProjectDocument["project"]["meta"],
        | "name"
        | "author"
        | "description"
        | "maxSpeed"
        | "acceleration"
        | "brakeDeceleration"
      >
    >,
  ) {
    if (!document.value) return;

    const previousMaxSpeed = document.value.project.meta.maxSpeed;

    document.value.project.meta = {
      ...document.value.project.meta,
      ...patch,
    };

    const nextMaxSpeed = document.value.project.meta.maxSpeed;

    if (
      typeof patch.maxSpeed === "number" &&
      nextMaxSpeed >= 0 &&
      nextMaxSpeed !== previousMaxSpeed
    ) {
      document.value.tracks.tracks.forEach((track) => {
        track.pitchCurve.keyframes = sortKeyframesBySpeed(
          track.pitchCurve.keyframes.map((keyframe) => ({
            ...keyframe,
            speed: normalizeSpeed(keyframe.speed, nextMaxSpeed),
            value: normalizeKeyframeValue("pitch", keyframe.value),
          })),
        );

        track.volumeCurve.keyframes = sortKeyframesBySpeed(
          track.volumeCurve.keyframes.map((keyframe) => ({
            ...keyframe,
            speed: normalizeSpeed(keyframe.speed, nextMaxSpeed),
            value: normalizeKeyframeValue("volume", keyframe.value),
          })),
        );
      });
    }

    markDirty();
  }

  function addTrack(name?: string) {
    if (!document.value) return null;

    const track = createDefaultTrack(
      name ?? `Track ${document.value.tracks.tracks.length + 1}`,
    );
    document.value.tracks.tracks.push(track);

    if (!document.value.tracks.activeTrackId) {
      document.value.tracks.activeTrackId = track.id;
    }

    markDirty();
    return track;
  }

  function removeTrack(trackId: ID) {
    if (!document.value) return;

    const beforeLength = document.value.tracks.tracks.length;
    document.value.tracks.tracks = document.value.tracks.tracks.filter(
      (t) => t.id !== trackId,
    );

    if (document.value.tracks.activeTrackId === trackId) {
      document.value.tracks.activeTrackId =
        document.value.tracks.tracks[0]?.id ?? null;
    }

    if (document.value.tracks.tracks.length !== beforeLength) {
      markDirty();
    }
  }

  function duplicateTrack(trackId: ID) {
    if (!document.value) return null;

    const source = document.value.tracks.tracks.find((t) => t.id === trackId);
    if (!source) return null;

    const duplicated: Track = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      name: `${source.name} Copy`,
      pitchCurve: {
        ...structuredClone(source.pitchCurve),
        keyframes: source.pitchCurve.keyframes.map((k) => ({
          ...structuredClone(k),
          id: crypto.randomUUID(),
        })),
      },
      volumeCurve: {
        ...structuredClone(source.volumeCurve),
        keyframes: source.volumeCurve.keyframes.map((k) => ({
          ...structuredClone(k),
          id: crypto.randomUUID(),
        })),
      },
    };

    document.value.tracks.tracks.push(duplicated);
    markDirty();
    return duplicated;
  }

  function setActiveTrack(trackId: ID | null) {
    if (!document.value) return;

    if (trackId === null) {
      document.value.tracks.activeTrackId = null;
      markDirty();
      return;
    }

    const exists = document.value.tracks.tracks.some(
      (track) => track.id === trackId,
    );
    if (!exists) return;

    document.value.tracks.activeTrackId = trackId;
    markDirty();
  }

  function updateTrack(
    trackId: ID,
    patch: Partial<
      Pick<
        Track,
        | "name"
        | "color"
        | "assetId"
        | "enabled"
        | "mute"
        | "solo"
        | "locked"
        | "visible"
      >
    >,
  ) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((t) => t.id === trackId);
    if (!track) return;

    Object.assign(track, patch);
    markDirty();
  }

  function setTrackAsset(trackId: ID, assetId: ID | null) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((t) => t.id === trackId);
    if (!track) return;

    if (assetId !== null) {
      const exists = document.value.tracks.assets.some((a) => a.id === assetId);
      if (!exists) return;
    }

    track.assetId = assetId;
    markDirty();
  }

  function addAsset(asset: Omit<AudioAsset, "id">) {
    if (!document.value) return null;

    const next: AudioAsset = {
      id: crypto.randomUUID(),
      ...asset,
    };

    document.value.tracks.assets.push(next);
    markDirty();
    return next;
  }

  function removeAsset(assetId: ID) {
    if (!document.value) return;

    document.value.tracks.assets = document.value.tracks.assets.filter(
      (asset) => asset.id !== assetId,
    );

    document.value.tracks.tracks.forEach((track) => {
      if (track.assetId === assetId) {
        track.assetId = null;
      }
    });

    markDirty();
  }

  function addKeyframe(
    trackId: ID,
    kind: CurveKind,
    speed: number,
    value: number,
  ) {
    if (!document.value) return null;

    const track = document.value.tracks.tracks.find((t) => t.id === trackId);
    if (!track) return null;

    const curve = getCurveByKind(track, kind);
    const maxSpeed = document.value.project.meta.maxSpeed;

    const keyframe: Keyframe = {
      id: crypto.randomUUID(),
      speed: normalizeSpeed(speed, maxSpeed),
      value: normalizeKeyframeValue(kind, value),
    };

    curve.keyframes = sortKeyframesBySpeed([...curve.keyframes, keyframe]);
    markDirty();
    return keyframe;
  }

  function updateKeyframe(
    trackId: ID,
    kind: CurveKind,
    keyframeId: ID,
    patch: Partial<Pick<Keyframe, "speed" | "value">>,
  ) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((t) => t.id === trackId);
    if (!track) return;

    const curve = getCurveByKind(track, kind);
    const keyframe = curve.keyframes.find((k) => k.id === keyframeId);
    if (!keyframe) return;

    const maxSpeed = document.value.project.meta.maxSpeed;

    if (typeof patch.speed === "number") {
      keyframe.speed = normalizeSpeed(patch.speed, maxSpeed);
    }

    if (typeof patch.value === "number") {
      keyframe.value = normalizeKeyframeValue(kind, patch.value);
    }

    curve.keyframes = sortKeyframesBySpeed(curve.keyframes);
    markDirty();
  }
  function removeKeyframe(trackId: ID, kind: CurveKind, keyframeId: ID) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((t) => t.id === trackId);
    if (!track) return;

    const curve = getCurveByKind(track, kind);
    const beforeLength = curve.keyframes.length;
    curve.keyframes = curve.keyframes.filter((k) => k.id !== keyframeId);

    if (curve.keyframes.length !== beforeLength) {
      markDirty();
    }
  }

  function replaceDocument(next: ProjectDocument) {
    document.value = next;
    dirty.value = true;
  }

  return {
    document,
    currentFilePath,
    dirty,

    hasProject,
    meta,
    tracks,
    assets,
    activeTrackId,
    activeTrack,

    clearProject,
    loadProject,
    createNewProject,
    setProjectFilePath,
    setProjectMeta,
    addTrack,
    removeTrack,
    duplicateTrack,
    setActiveTrack,
    updateTrack,
    setTrackAsset,
    addAsset,
    removeAsset,
    addKeyframe,
    updateKeyframe,
    removeKeyframe,
    replaceDocument,
  };
});
