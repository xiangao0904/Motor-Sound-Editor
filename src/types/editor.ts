import type { ID } from "./common";
import type { CurveKind, CurveSetKind } from "./track";

export type EditorTool = "select" | "move" | "keyframe";
export type SimMode = "traction" | "coasting" | "brake";
export type SimulatorMode = SimMode;
export type TransportState = "stopped" | "playing" | "paused";

export interface SelectedKeyframeRef {
  trackId: ID;
  curveSet: CurveSetKind;
  kind: CurveKind;
  keyframeId: ID;
}

export interface HoveredKeyframeRef {
  trackId: ID;
  curveSet: CurveSetKind;
  kind: CurveKind;
  keyframeId: ID;
}

export interface EditorRuntimeState {
  simulator: {
    mode: SimulatorMode;
    currentSpeed: number;
    maxSpeed: number;
    acceleration: number;
    brakeDeceleration: number;
  };
  playback: {
    transport: TransportState;
    playheadSpeed: number;
    audioEnabled: boolean;
  };
  selection: {
    activeTrackId: ID | null;
    selectedKeyframe: SelectedKeyframeRef | null;
    hoveredKeyframe: HoveredKeyframeRef | null;
  };
  view: {
    tool: EditorTool;
    zoomX: number;
    zoomY: number;
    offsetX: number;
    offsetY: number;
  };
}
