import { toRaw } from "vue";
import type { EditorRuntimeState } from "@/types/editor";
import type { ProjectDocument, ProjectFile, ProjectMeta, TracksFile } from "@/types/project";
import type {
  AudioAsset,
  Keyframe,
  Track,
  TrackCurve,
  TrackCurveSet,
} from "@/types/track";

export function deepClone<T>(value: T): T {
  return structuredClone(toRaw(value));
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function sanitizeKeyframe(keyframe: Keyframe): Keyframe {
  return {
    id: String(keyframe.id),
    speed: Number(keyframe.speed),
    value: Number(keyframe.value),
  };
}

export function sanitizeTrackCurve(curve: TrackCurve): TrackCurve {
  return {
    kind: curve.kind,
    interpolation: curve.interpolation,
    keyframes: curve.keyframes.map(sanitizeKeyframe),
  };
}

export function sanitizeTrackCurveSet(curveSet: TrackCurveSet): TrackCurveSet {
  return {
    pitch: sanitizeTrackCurve(curveSet.pitch),
    volume: sanitizeTrackCurve(curveSet.volume),
  };
}

export function sanitizeTrack(track: Track): Track {
  return {
    id: String(track.id),
    name: String(track.name),
    color: String(track.color),
    assetId: track.assetId === null ? null : String(track.assetId),
    enabled: Boolean(track.enabled),
    mute: Boolean(track.mute),
    visible: track.visible !== false,
    locked: track.locked === true,
    curveSets: {
      traction: sanitizeTrackCurveSet(track.curveSets.traction),
      brake: sanitizeTrackCurveSet(track.curveSets.brake),
    },
  };
}

export function sanitizeAudioAsset(asset: AudioAsset): AudioAsset {
  return {
    id: String(asset.id),
    fileName: String(asset.fileName),
    originalPath: optionalString(asset.originalPath),
    packagedPath: String(asset.packagedPath),
    format: asset.format,
    size: Number(asset.size),
    checksum: optionalString(asset.checksum),
    durationSec: optionalNumber(asset.durationSec),
    sampleRate: optionalNumber(asset.sampleRate),
    channels: optionalNumber(asset.channels),
  };
}

export function sanitizeProjectMeta(meta: ProjectMeta): ProjectMeta {
  return {
    id: String(meta.id),
    name: String(meta.name),
    author: optionalString(meta.author),
    appVersion: String(meta.appVersion),
    schemaVersion: Number(meta.schemaVersion),
    createdAt: String(meta.createdAt),
    updatedAt: String(meta.updatedAt),
    maxSpeed: Number(meta.maxSpeed),
    acceleration: Number(meta.acceleration),
    brakeDeceleration: Number(meta.brakeDeceleration),
    description: optionalString(meta.description),
    lastOpenedAt: optionalString(meta.lastOpenedAt),
  };
}

export function sanitizeProjectFile(project: ProjectFile): ProjectFile {
  return {
    meta: sanitizeProjectMeta(project.meta),
  };
}

export function sanitizeTracksFile(tracks: TracksFile): TracksFile {
  return {
    activeTrackId:
      tracks.activeTrackId === null ? null : String(tracks.activeTrackId),
    tracks: tracks.tracks.map(sanitizeTrack),
    assets: tracks.assets.map(sanitizeAudioAsset),
  };
}

export function sanitizeProjectDocument(document: ProjectDocument): ProjectDocument {
  return {
    project: sanitizeProjectFile(document.project),
    tracks: sanitizeTracksFile(document.tracks),
  };
}

export function sanitizeEditorRuntime(runtime: EditorRuntimeState): EditorRuntimeState {
  return {
    simulator: {
      mode: runtime.simulator.mode,
      currentSpeed: Number(runtime.simulator.currentSpeed),
      maxSpeed: Number(runtime.simulator.maxSpeed),
      acceleration: Number(runtime.simulator.acceleration),
      brakeDeceleration: Number(runtime.simulator.brakeDeceleration),
    },
    playback: {
      transport: runtime.playback.transport,
      playheadSpeed: Number(runtime.playback.playheadSpeed),
      audioEnabled: Boolean(runtime.playback.audioEnabled),
    },
    selection: {
      activeTrackId:
        runtime.selection.activeTrackId === null
          ? null
          : String(runtime.selection.activeTrackId),
      selectedKeyframe: runtime.selection.selectedKeyframe
        ? {
            trackId: String(runtime.selection.selectedKeyframe.trackId),
            curveSet: runtime.selection.selectedKeyframe.curveSet,
            kind: runtime.selection.selectedKeyframe.kind,
            keyframeId: String(runtime.selection.selectedKeyframe.keyframeId),
          }
        : null,
      hoveredKeyframe: runtime.selection.hoveredKeyframe
        ? {
            trackId: String(runtime.selection.hoveredKeyframe.trackId),
            curveSet: runtime.selection.hoveredKeyframe.curveSet,
            kind: runtime.selection.hoveredKeyframe.kind,
            keyframeId: String(runtime.selection.hoveredKeyframe.keyframeId),
          }
        : null,
    },
    view: {
      tool: runtime.view.tool,
      zoomX: Number(runtime.view.zoomX),
      zoomY: Number(runtime.view.zoomY),
      offsetX: Number(runtime.view.offsetX),
      offsetY: Number(runtime.view.offsetY),
    },
  };
}
