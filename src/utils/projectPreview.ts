import { CURVE_MAX_VALUE } from "@/constants/curveRanges";
import { sampleCurvesBatch } from "@/services/nativeInterop";
import type { ProjectDocument, ProjectPreviewLine } from "@/types/project";
import type { TrackCurve } from "@/types/track";
import { sampleCurve } from "@/utils/curves";

const PREVIEW_POINT_COUNT = 9;
const MAX_PREVIEW_TRACKS = 6;

function curvePreview(curve: TrackCurve, maxSpeed: number): number[] {
  return Array.from({ length: PREVIEW_POINT_COUNT }, (_, index) => {
    const speed = (maxSpeed / (PREVIEW_POINT_COUNT - 1)) * index;
    const value = sampleCurve(curve, speed);
    const normalized = Math.max(0, Math.min(value / CURVE_MAX_VALUE[curve.kind], 1));
    return 92 - normalized * 72;
  });
}

function pointsToPolylineText(values: number[]): string {
  const maxIndex = values.length - 1;

  return values
    .map((value, index) => {
      const x = maxIndex === 0 ? 0 : (index / maxIndex) * 100;
      return `${x.toFixed(1)},${value.toFixed(1)}`;
    })
    .join(" ");
}

function createPreviewLine(
  trackId: string,
  color: string,
  points: number[],
): ProjectPreviewLine {
  return { trackId, color, points, pointsText: pointsToPolylineText(points) };
}

function selectPreviewTracks(document: ProjectDocument) {
  return document.tracks.tracks.slice(0, MAX_PREVIEW_TRACKS);
}

export async function createProjectPreview(document: ProjectDocument) {
  const tracks = selectPreviewTracks(document);
  const maxSpeed = document.project.meta.maxSpeed || 1;
  const speeds = Array.from(
    { length: PREVIEW_POINT_COUNT },
    (_, index) => (maxSpeed / (PREVIEW_POINT_COUNT - 1)) * index,
  );

  if (tracks.length === 0) {
    return {
      previewLines: [],
    };
  }

  try {
    const sampled = await sampleCurvesBatch(tracks, speeds, "traction");
    if (sampled.length > 0) {
      const colorByTrackId = new Map(
        tracks.map((track) => [track.id, track.color] as const),
      );

      return {
        previewLines: sampled.map((item) =>
          createPreviewLine(
            item.trackId,
            colorByTrackId.get(item.trackId) ?? "#9FB9C9",
            item.pitch.map((value) => {
              const normalized = Math.max(
                0,
                Math.min(value / CURVE_MAX_VALUE.pitch, 1),
              );
              return 92 - normalized * 72;
            }),
          ),
        ),
      };
    }
  } catch {
    // Fall back to the local sampler if the native bridge is unavailable.
  }

  return {
    previewLines: tracks.map((track) =>
      createPreviewLine(
        track.id,
        track.color,
        curvePreview(track.curveSets.traction.pitch, maxSpeed),
      ),
    ),
  };
}
