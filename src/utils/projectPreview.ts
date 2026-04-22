import { CURVE_MAX_VALUE } from "@/constants/curveRanges";
import type { ProjectDocument } from "@/types/project";
import type { TrackCurve } from "@/types/track";

function sampleCurve(curve: TrackCurve, speed: number): number {
  const keyframes = [...curve.keyframes].sort((a, b) => a.speed - b.speed);

  if (keyframes.length === 0) return curve.kind === "pitch" ? 1 : 0;
  if (speed <= keyframes[0].speed) return keyframes[0].value;

  for (let index = 1; index < keyframes.length; index += 1) {
    const previous = keyframes[index - 1];
    const next = keyframes[index];

    if (speed <= next.speed) {
      const span = next.speed - previous.speed;
      const ratio = span === 0 ? 0 : (speed - previous.speed) / span;
      return previous.value + (next.value - previous.value) * ratio;
    }
  }

  return keyframes[keyframes.length - 1].value;
}

function curvePreview(curve: TrackCurve, maxSpeed: number): number[] {
  const points = 9;

  return Array.from({ length: points }, (_, index) => {
    const speed = (maxSpeed / (points - 1)) * index;
    const value = sampleCurve(curve, speed);
    const normalized = Math.max(0, Math.min(value / CURVE_MAX_VALUE[curve.kind], 1));
    return 92 - normalized * 72;
  });
}

export function createProjectPreview(document: ProjectDocument) {
  const track =
    document.tracks.tracks.find((item) => item.visible !== false) ??
    document.tracks.tracks[0];
  const maxSpeed = document.project.meta.maxSpeed || 1;

  if (!track) {
    return {
      previewPitch: [],
      previewVolume: [],
    };
  }

  return {
    previewPitch: curvePreview(track.curveSets.traction.pitch, maxSpeed),
    previewVolume: curvePreview(track.curveSets.traction.volume, maxSpeed),
  };
}
