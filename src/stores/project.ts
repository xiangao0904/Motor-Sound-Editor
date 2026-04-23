import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { clamp } from "@/utils/math";
import { CURVE_MAX_VALUE } from "@/constants/curveRanges";
import {
  revokeAssetObjectUrl,
  revokeDocumentObjectUrls,
} from "@/services/msepProject";

import type { ID } from "@/types/common";
import type { CreateProjectPayload, ProjectDocument } from "@/types/project";
import type {
  AudioAsset,
  CurveKind,
  CurveSetKind,
  Keyframe,
  Track,
  TrackCurve,
  TrackCurveSet,
} from "@/types/track";
import { createDefaultTrack, createProjectDocument } from "@/types/factories";
import { sanitizeTrack } from "@/utils/clone";

function normalizeSpeed(speed: number, maxSpeed: number): number {
  return clamp(Number.isFinite(speed) ? speed : 0, 0, maxSpeed);
}

function normalizeKeyframeValue(kind: CurveKind, value: number): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  return clamp(safeValue, 0, CURVE_MAX_VALUE[kind]);
}

function sortKeyframesBySpeed(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.speed - b.speed);
}

function getCurve(
  track: Track,
  curveSet: CurveSetKind,
  kind: CurveKind,
): TrackCurve {
  return track.curveSets[curveSet][kind];
}

function normalizeTrackCurves(track: Track, maxSpeed: number) {
  (["traction", "brake"] satisfies CurveSetKind[]).forEach((curveSet) => {
    (["pitch", "volume"] satisfies CurveKind[]).forEach((kind) => {
      const curve = getCurve(track, curveSet, kind);
      curve.keyframes = sortKeyframesBySpeed(
        curve.keyframes.map((keyframe) => ({
          ...keyframe,
          speed: normalizeSpeed(keyframe.speed, maxSpeed),
          value: normalizeKeyframeValue(kind, keyframe.value),
        })),
      );
    });
  });
}

function normalizeProjectDocument(document: ProjectDocument): ProjectDocument {
  document.tracks.tracks.forEach((track) => {
    normalizeTrackCurves(track, document.project.meta.maxSpeed);
  });

  return document;
}

function normalizeCurveSetDraft(
  curveSet: TrackCurveSet,
  maxSpeed: number,
): TrackCurveSet {
  return {
    pitch: {
      ...curveSet.pitch,
      kind: "pitch",
      keyframes: sortKeyframesBySpeed(
        curveSet.pitch.keyframes.map((keyframe) => ({
          id: keyframe.id || crypto.randomUUID(),
          speed: normalizeSpeed(keyframe.speed, maxSpeed),
          value: normalizeKeyframeValue("pitch", keyframe.value),
        })),
      ),
    },
    volume: {
      ...curveSet.volume,
      kind: "volume",
      keyframes: sortKeyframesBySpeed(
        curveSet.volume.keyframes.map((keyframe) => ({
          id: keyframe.id || crypto.randomUUID(),
          speed: normalizeSpeed(keyframe.speed, maxSpeed),
          value: normalizeKeyframeValue("volume", keyframe.value),
        })),
      ),
    },
  };
}

function channelToHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0").toUpperCase();
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = hue / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = l - chroma / 2;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment >= 0 && segment < 1) {
    red = chroma;
    green = second;
  } else if (segment < 2) {
    red = second;
    green = chroma;
  } else if (segment < 3) {
    green = chroma;
    blue = second;
  } else if (segment < 4) {
    green = second;
    blue = chroma;
  } else if (segment < 5) {
    red = second;
    blue = chroma;
  } else {
    red = chroma;
    blue = second;
  }

  return `#${channelToHex((red + match) * 255)}${channelToHex(
    (green + match) * 255,
  )}${channelToHex((blue + match) * 255)}`;
}

function createRandomTrackColor(): string {
  const hue = Math.random() * 360;
  const saturation = 70 + Math.random() * 20;
  const lightness = 65 + Math.random() * 15;

  return hslToHex(hue, saturation, lightness);
}

export const useProjectStore = defineStore("project", () => {
  const document = ref<ProjectDocument | null>(null);
  const currentFilePath = ref<string | null>(null);
  const dirty = ref(false);

  const hasProject = computed(() => document.value !== null);
  const meta = computed(() => document.value?.project.meta ?? null);
  const tracks = computed(() => document.value?.tracks.tracks ?? []);
  const assets = computed(() => document.value?.tracks.assets ?? []);
  const trackById = computed(
    () => new Map(tracks.value.map((track) => [track.id, track])),
  );
  const assetById = computed(
    () => new Map(assets.value.map((asset) => [asset.id, asset])),
  );
  const activeTrackId = computed(
    () => document.value?.tracks.activeTrackId ?? null,
  );

  const activeTrack = computed(() => {
    const activeId = activeTrackId.value;
    return activeId ? trackById.value.get(activeId) ?? null : null;
  });

  function markDirty() {
    if (!document.value) return;

    document.value.project.meta.updatedAt = new Date().toISOString();
    dirty.value = true;
  }

  function clearProject() {
    revokeDocumentObjectUrls(document.value);
    document.value = null;
    currentFilePath.value = null;
    dirty.value = false;
  }

  function loadProject(next: ProjectDocument, filePath?: string) {
    revokeDocumentObjectUrls(document.value);
    document.value = normalizeProjectDocument(next);
    currentFilePath.value = filePath ?? null;
    dirty.value = false;
  }

  function createNewProject(payload: CreateProjectPayload) {
    revokeDocumentObjectUrls(document.value);
    const next = createProjectDocument(payload);
    document.value = normalizeProjectDocument(next);
    currentFilePath.value = null;
    dirty.value = false;
  }

  function setProjectFilePath(filePath: string | null) {
    currentFilePath.value = filePath;
  }

  function markSaved(filePath?: string) {
    if (filePath !== undefined) {
      currentFilePath.value = filePath;
    }

    dirty.value = false;
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
        normalizeTrackCurves(track, nextMaxSpeed);
      });
    }

    markDirty();
  }

  function addTrack(name?: string) {
    if (!document.value) return null;

    const trackIndex = document.value.tracks.tracks.length;
    const track = createDefaultTrack(
      name ?? `motor${trackIndex}`,
      document.value.project.meta.maxSpeed,
      createRandomTrackColor(),
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
      (track) => track.id !== trackId,
    );

    if (document.value.tracks.activeTrackId === trackId) {
      document.value.tracks.activeTrackId = null;
    }

    if (document.value.tracks.tracks.length !== beforeLength) {
      markDirty();
    }
  }

  function duplicateTrack(trackId: ID) {
    if (!document.value) return null;

    const source = document.value.tracks.tracks.find(
      (track) => track.id === trackId,
    );
    if (!source) return null;

    const duplicated: Track = sanitizeTrack(source);
    duplicated.id = crypto.randomUUID();
    duplicated.name = `${source.name} Copy`;

    (["traction", "brake"] satisfies CurveSetKind[]).forEach((curveSet) => {
      (["pitch", "volume"] satisfies CurveKind[]).forEach((kind) => {
        duplicated.curveSets[curveSet][kind].keyframes =
          duplicated.curveSets[curveSet][kind].keyframes.map((keyframe) => ({
            ...keyframe,
            id: crypto.randomUUID(),
          }));
      });
    });

    document.value.tracks.tracks.push(duplicated);
    markDirty();
    return duplicated;
  }

  function setActiveTrack(trackId: ID | null) {
    if (!document.value) return;

    if (trackId === null) {
      if (document.value.tracks.activeTrackId === null) return;

      document.value.tracks.activeTrackId = null;
      markDirty();
      return;
    }

    const exists = document.value.tracks.tracks.some(
      (track) => track.id === trackId,
    );
    if (!exists) return;
    if (document.value.tracks.activeTrackId === trackId) return;

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
        | "locked"
        | "visible"
      >
    >,
  ) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((item) => item.id === trackId);
    if (!track) return;

    Object.assign(track, patch);
    markDirty();
  }

  function setTrackAsset(trackId: ID, assetId: ID | null) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((item) => item.id === trackId);
    if (!track) return;

    if (assetId !== null) {
      const exists = document.value.tracks.assets.some((asset) => asset.id === assetId);
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
      (asset) => {
        if (asset.id === assetId) {
          revokeAssetObjectUrl(asset);
          return false;
        }

        return true;
      },
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
    curveSet: CurveSetKind,
    kind: CurveKind,
    speed: number,
    value: number,
  ) {
    if (!document.value) return null;

    const track = document.value.tracks.tracks.find((item) => item.id === trackId);
    if (!track) return null;

    const curve = getCurve(track, curveSet, kind);
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
    curveSet: CurveSetKind,
    kind: CurveKind,
    keyframeId: ID,
    patch: Partial<Pick<Keyframe, "speed" | "value">>,
  ) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((item) => item.id === trackId);
    if (!track) return;

    const curve = getCurve(track, curveSet, kind);
    const keyframe = curve.keyframes.find((item) => item.id === keyframeId);
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

  function moveKeyframeDraft(
    trackId: ID,
    curveSet: CurveSetKind,
    kind: CurveKind,
    keyframeId: ID,
    patch: Partial<Pick<Keyframe, "speed" | "value">>,
  ) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((item) => item.id === trackId);
    if (!track) return;

    const curve = getCurve(track, curveSet, kind);
    const keyframe = curve.keyframes.find((item) => item.id === keyframeId);
    if (!keyframe) return;

    const maxSpeed = document.value.project.meta.maxSpeed;

    if (typeof patch.speed === "number") {
      keyframe.speed = normalizeSpeed(patch.speed, maxSpeed);
    }

    if (typeof patch.value === "number") {
      keyframe.value = normalizeKeyframeValue(kind, patch.value);
    }

    if (typeof patch.speed === "number") {
      curve.keyframes = sortKeyframesBySpeed(curve.keyframes);
    }

    markDirty();
  }

  function removeKeyframe(
    trackId: ID,
    curveSet: CurveSetKind,
    kind: CurveKind,
    keyframeId: ID,
  ) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((item) => item.id === trackId);
    if (!track) return;

    const curve = getCurve(track, curveSet, kind);
    const beforeLength = curve.keyframes.length;
    curve.keyframes = curve.keyframes.filter((item) => item.id !== keyframeId);

    if (curve.keyframes.length !== beforeLength) {
      markDirty();
    }
  }

  function replaceTrackCurveSets(
    trackId: ID,
    curveSets: Record<CurveSetKind, TrackCurveSet>,
  ) {
    if (!document.value) return;

    const track = document.value.tracks.tracks.find((item) => item.id === trackId);
    if (!track) return;

    const maxSpeed = document.value.project.meta.maxSpeed;
    track.curveSets = {
      traction: normalizeCurveSetDraft(curveSets.traction, maxSpeed),
      brake: normalizeCurveSetDraft(curveSets.brake, maxSpeed),
    };
    markDirty();
  }

  function replaceDocument(next: ProjectDocument) {
    revokeDocumentObjectUrls(document.value);
    document.value = normalizeProjectDocument(next);
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
    trackById,
    assetById,
    activeTrackId,
    activeTrack,

    clearProject,
    loadProject,
    createNewProject,
    setProjectFilePath,
    markSaved,
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
    moveKeyframeDraft,
    removeKeyframe,
    replaceTrackCurveSets,
    replaceDocument,
  };
});
