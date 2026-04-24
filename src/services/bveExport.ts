import type { ID } from "@/types/common";
import type { ProjectDocument } from "@/types/project";
import type { AudioAsset, Track } from "@/types/track";
import { exportNativeBveProject } from "@/services/nativeInterop";

export type ExportFormat = "bve";

export interface BveExportOptions {
  format: ExportFormat;
  sampleRate: number;
}

interface ExportableTrack {
  track: Track;
  asset: AudioAsset;
}

function exportableTracks(
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
): ExportableTrack[] {
  const assetById = new Map(
    document.tracks.assets.map((asset) => [asset.id, asset]),
  );

  return document.tracks.tracks
    .filter((track) => track.enabled && !track.mute && track.assetId)
    .flatMap((track) => {
      const asset = track.assetId ? assetById.get(track.assetId) : null;
      const bytes = track.assetId ? assetPayloads.get(track.assetId) : null;

      if (!asset || !bytes) return [];

      return [
        {
          track,
          asset,
        },
      ];
    });
}

export function hasOggExportTracks(
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
): boolean {
  return exportableTracks(document, assetPayloads).some(
    ({ asset }) => asset.format === "ogg",
  );
}

export async function exportBveProject(
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
  outputPath: string,
  options: BveExportOptions,
): Promise<void> {
  if (options.format !== "bve") {
    throw new Error("Only BVE export is currently supported.");
  }

  const tracks = exportableTracks(document, assetPayloads);
  if (tracks.length === 0) {
    throw new Error("No exportable tracks have assigned audio.");
  }

  await exportNativeBveProject(document, assetPayloads, outputPath, options);
}
