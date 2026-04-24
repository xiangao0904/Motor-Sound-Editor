import { invoke } from "@tauri-apps/api/core";

import type { ID } from "@/types/common";
import type { ProjectDocument } from "@/types/project";
import type { CurveSetKind, Track } from "@/types/track";
import { sanitizeProjectDocument } from "@/utils/clone";

type RawPayloadRecord = Record<string, number[]>;

export interface LoadedNativeProject {
  document: ProjectDocument;
  assetPayloads: RawPayloadRecord;
}

export interface AudioMetadataSource {
  assetId?: ID;
  path?: string;
  fileName?: string;
  bytes?: number[];
}

export interface AudioMetadataResult {
  assetId?: ID;
  path?: string;
  durationSec?: number;
  sampleRate?: number;
  channels?: number;
  error?: string;
}

export interface SampledTrackCurves {
  trackId: ID;
  pitch: number[];
  volume: number[];
}

export interface NativeBveExportOptions {
  format: "bve";
  sampleRate: number;
}

export function serializePayloadMap(
  assetPayloads: Map<ID, Uint8Array>,
): RawPayloadRecord {
  return Object.fromEntries(
    [...assetPayloads.entries()].map(([assetId, bytes]) => [assetId, Array.from(bytes)]),
  );
}

export function deserializePayloadRecord(
  assetPayloads: RawPayloadRecord,
): Map<ID, Uint8Array> {
  return new Map(
    Object.entries(assetPayloads).map(([assetId, bytes]) => [
      assetId,
      new Uint8Array(bytes),
    ]),
  );
}

export async function saveNativeMsepProject(
  path: string,
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
): Promise<void> {
  await invoke("pack_msep_file", {
    path,
    document: sanitizeProjectDocument(document),
    assetPayloads: serializePayloadMap(assetPayloads),
  });
}

export async function openNativeMsepProject(
  path: string,
): Promise<LoadedNativeProject> {
  return invoke<LoadedNativeProject>("open_msep_file", { path });
}

export async function readAudioMetadataBatch(
  items: AudioMetadataSource[],
): Promise<AudioMetadataResult[]> {
  return invoke<AudioMetadataResult[]>("read_audio_metadata_batch", { items });
}

export async function sampleCurvesBatch(
  tracks: Track[],
  speeds: number[],
  curveSet: CurveSetKind,
): Promise<SampledTrackCurves[]> {
  return invoke<SampledTrackCurves[]>("sample_curves_batch", {
    tracks,
    speeds,
    curveSet,
  });
}

export async function exportNativeBveProject(
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
  outputPath: string,
  options: NativeBveExportOptions,
): Promise<void> {
  await invoke("export_bve_project", {
    document: sanitizeProjectDocument(document),
    assetPayloads: serializePayloadMap(assetPayloads),
    outputPath,
    options,
  });
}
