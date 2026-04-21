import { APP_VERSION, PROJECT_SCHEMA_VERSION } from "./project";
import type { CreateProjectPayload, ProjectDocument } from "./project";
import type {
  CurveKind,
  Keyframe,
  Track,
  TrackCurve,
  TrackCurveSet,
} from "./track";
import type { EditorRuntimeState } from "./editor";

function createKeyframes(kind: CurveKind, maxSpeed: number): Keyframe[] {
  if (kind === "pitch") {
    return [
      { id: crypto.randomUUID(), speed: 0, value: 1 },
      { id: crypto.randomUUID(), speed: maxSpeed * 0.2, value: 1.5 },
      { id: crypto.randomUUID(), speed: maxSpeed * 0.5, value: 1 },
      { id: crypto.randomUUID(), speed: maxSpeed, value: 0.55 },
    ];
  }

  return [
    { id: crypto.randomUUID(), speed: 0, value: 0 },
    { id: crypto.randomUUID(), speed: maxSpeed * 0.08, value: 0.9 },
    { id: crypto.randomUUID(), speed: maxSpeed * 0.5, value: 1 },
    { id: crypto.randomUUID(), speed: maxSpeed, value: 1 },
  ];
}

function createDefaultCurve(kind: CurveKind, maxSpeed: number): TrackCurve {
  return {
    kind,
    interpolation: "linear",
    keyframes: createKeyframes(kind, maxSpeed),
  };
}

function createDefaultCurveSet(maxSpeed: number): TrackCurveSet {
  return {
    pitch: createDefaultCurve("pitch", maxSpeed),
    volume: createDefaultCurve("volume", maxSpeed),
  };
}

export function createDefaultTrack(name = "Track 1", maxSpeed = 120): Track {
  return {
    id: crypto.randomUUID(),
    name,
    color: "#60A5FA",
    assetId: null,
    enabled: true,
    mute: false,
    visible: true,
    locked: false,
    curveSets: {
      traction: createDefaultCurveSet(maxSpeed),
      brake: createDefaultCurveSet(maxSpeed),
    },
  };
}

export function createProjectDocument(
  payload: CreateProjectPayload,
): ProjectDocument {
  const now = new Date().toISOString();

  return {
    project: {
      meta: {
        id: crypto.randomUUID(),
        name: payload.name,
        author: payload.author,
        appVersion: APP_VERSION,
        schemaVersion: PROJECT_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        maxSpeed: payload.maxSpeed ?? 120,
        acceleration: payload.acceleration ?? 1.2,
        brakeDeceleration: payload.brakeDeceleration ?? 1.2,
      },
    },
    tracks: {
      activeTrackId: null,
      tracks: [],
      assets: [],
    },
  };
}

export function createDefaultEditorRuntime(
  maxSpeed = 120,
  acceleration = 1.2,
  brakeDeceleration = 1.2,
): EditorRuntimeState {
  return {
    simulator: {
      mode: "coasting",
      currentSpeed: 0,
      maxSpeed,
      acceleration,
      brakeDeceleration,
    },
    playback: {
      transport: "stopped",
      playheadSpeed: 0,
      audioEnabled: false,
    },
    selection: {
      activeTrackId: null,
      selectedKeyframe: null,
      hoveredKeyframe: null,
    },
    view: {
      tool: "select",
      zoomX: 1,
      zoomY: 1,
      offsetX: 0,
      offsetY: 0,
    },
  };
}
