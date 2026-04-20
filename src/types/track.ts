import type { ID } from "./common";

/** 音轨支持的属性通道 */
export type CurveKind = "pitch" | "volume";

/** 插值方式，先保留线性/平滑，后面可扩展 */
export type InterpolationType = "linear" | "smooth";

/** 资源格式 */
export type AudioFormat = "wav" | "ogg";

/** 关键帧值类型
 * pitch: 推荐以倍率表达，1.0 = 原速
 * volume: 推荐以 0~1 表达
 */
export interface Keyframe {
  id: ID;
  speed: number;
  value: number;
}

/** 单条曲线 */
export interface TrackCurve {
  kind: CurveKind;
  interpolation: InterpolationType;
  keyframes: Keyframe[];
}

/** 工程中的音频资源 */
export interface AudioAsset {
  id: ID;
  fileName: string;
  originalPath?: string;
  packagedPath: string;
  format: AudioFormat;
  size: number;
  checksum?: string;
  durationSec?: number;
  sampleRate?: number;
  channels?: number;
}

/** 单条音轨 */
export interface Track {
  id: ID;
  name: string;
  color: string;

  /** 指向资源池中的某个音频 */
  assetId: ID | null;

  /** 音轨运行态 */
  enabled: boolean;
  mute: boolean;
  solo: boolean;

  /** 两条核心曲线 */
  pitchCurve: TrackCurve;
  volumeCurve: TrackCurve;

  /** 预留 */
  locked?: boolean;
  visible?: boolean;
}
