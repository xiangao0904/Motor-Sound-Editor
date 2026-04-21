import type { ID } from "./common";

export type CurveKind = "pitch" | "volume";
export type CurveSetKind = "traction" | "brake";
export type InterpolationType = "linear" | "smooth";
export type AudioFormat = "wav" | "ogg";

export interface Keyframe {
  id: ID;
  speed: number;
  value: number;
}

export interface TrackCurve {
  kind: CurveKind;
  interpolation: InterpolationType;
  keyframes: Keyframe[];
}

export interface TrackCurveSet {
  pitch: TrackCurve;
  volume: TrackCurve;
}

export interface AudioAsset {
  id: ID;
  fileName: string;
  originalPath?: string;
  packagedPath: string;
  objectUrl?: string;
  format: AudioFormat;
  size: number;
  checksum?: string;
  durationSec?: number;
  sampleRate?: number;
  channels?: number;
}

export interface Track {
  id: ID;
  name: string;
  color: string;
  assetId: ID | null;
  enabled: boolean;
  mute: boolean;
  curveSets: Record<CurveSetKind, TrackCurveSet>;
  locked?: boolean;
  visible?: boolean;
}
