export type EditorTool = "select" | "move" | "keyframe";
export type SimMode = "traction" | "coasting" | "brake";

export interface KeyframePoint {
  id: string;
  x: number;
  y: number;
}

export interface TrackCurve {
  pitchPoints: KeyframePoint[];
  volumePoints: KeyframePoint[];
}

export interface AudioTrack {
  id: string;
  name: string;
  color: string;
  filePath: string | null;
  mute: boolean;
  solo: boolean;
  curve: TrackCurve;
}

export interface SelectionState {
  activeTrackId: string | null;
  selectedPitchPointId: string | null;
  selectedVolumePointId: string | null;
}

export interface SimulatorState {
  mode: SimMode;
  currentSpeed: number;
  maxSpeed: number;
  acceleration: number;
  brakeDeceleration: number;
  isPlaying: boolean;
}
