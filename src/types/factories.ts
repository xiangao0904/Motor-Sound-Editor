import { APP_VERSION, PROJECT_SCHEMA_VERSION } from "./project";
import type { CreateProjectPayload, ProjectDocument } from "./project";
import type { CurveKind, Track, TrackCurve, TrackCurveSet } from "./track";
import type { EditorRuntimeState } from "./editor";

function createDefaultCurve(kind: CurveKind): TrackCurve {
  return {
    kind,
    interpolation: "linear",
    keyframes: [],
  };
}

function createDefaultCurveSet(): TrackCurveSet {
  return {
    pitch: createDefaultCurve("pitch"),
    volume: createDefaultCurve("volume"),
  };
}

export function createDefaultTrack(
  name = "Track 1",
  _maxSpeed = 120,
  color = "#60A5FA",
): Track {
  return {
    id: crypto.randomUUID(),
    name,
    color,
    assetId: null,
    enabled: true,
    mute: false,
    visible: true,
    locked: false,
    curveSets: {
      traction: createDefaultCurveSet(),
      brake: createDefaultCurveSet(),
    },
  };
}

export function createProjectDocument(
  payload: CreateProjectPayload,
): ProjectDocument {
  const now = new Date().toISOString();
  const defaultTrack = createDefaultTrack(
    "motor0",
    payload.maxSpeed ?? 120,
    "#FFE796",
  );

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
      activeTrackId: defaultTrack.id,
      tracks: [defaultTrack],
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
