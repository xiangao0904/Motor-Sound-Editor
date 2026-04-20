import { APP_VERSION, PROJECT_SCHEMA_VERSION } from "./project";
import type { CreateProjectPayload, ProjectDocument } from "./project";
import type { Track, TrackCurve } from "./track";
import type { EditorRuntimeState } from "./editor";

function createDefaultCurve(kind: "pitch" | "volume"): TrackCurve {
  return {
    kind,
    interpolation: "linear",
    keyframes:
      kind === "pitch"
        ? [
            { id: crypto.randomUUID(), speed: 0, value: 1.0 },
            { id: crypto.randomUUID(), speed: 120, value: 1.0 },
          ]
        : [
            { id: crypto.randomUUID(), speed: 0, value: 1.0 },
            { id: crypto.randomUUID(), speed: 120, value: 1.0 },
          ],
  };
}

export function createDefaultTrack(name = "Track 1"): Track {
  return {
    id: crypto.randomUUID(),
    name,
    color: "#60A5FA",
    assetId: null,
    enabled: true,
    mute: false,
    solo: false,
    visible: true,
    locked: false,
    pitchCurve: createDefaultCurve("pitch"),
    volumeCurve: createDefaultCurve("volume"),
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
