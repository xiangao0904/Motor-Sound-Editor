import type { ID } from "@/types/common";
import type { ProjectDocument } from "@/types/project";
import type { AudioAsset, Track } from "@/types/track";
import {
  exportNativeBveProject,
  exportNativeMtrProject,
} from "@/services/nativeInterop";

export type ExportFormat = "bve" | "mtr";

export interface BveExportOptions {
  format: "bve";
  sampleRate: number;
}

export interface MtrExportOptions {
  format: "mtr";
  sampleRate: number;
  attenuationDistance: 16 | 32 | 64;
}

export type ExportOptions = BveExportOptions | MtrExportOptions;

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

export async function exportProjectArchive(
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
  outputPath: string,
  options: ExportOptions,
): Promise<void> {
  const tracks = exportableTracks(document, assetPayloads);
  if (tracks.length === 0) {
    throw new Error("No exportable tracks have assigned audio.");
  }

  if (options.format === "bve") {
    await exportNativeBveProject(document, assetPayloads, outputPath, options);
    return;
  }

  if (options.format === "mtr") {
    await exportNativeMtrProject(document, assetPayloads, outputPath, options);
    return;
  }

  throw new Error(`Unsupported export format: ${String(options)}`);
}
