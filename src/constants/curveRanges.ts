import type { CurveKind } from "@/types/track";

export const CURVE_MIN_VALUE: Record<CurveKind, number> = {
  pitch: 0.01,
  volume: 0,
};

export const CURVE_MAX_VALUE: Record<CurveKind, number> = {
  pitch: 3.5,
  volume: 2,
};
