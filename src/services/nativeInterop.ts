import { invoke } from "@tauri-apps/api/core";

import type { ID } from "@/types/common";
import type { ProjectDocument } from "@/types/project";
import type { CurveSetKind, Track } from "@/types/track";
import { sanitizeProjectDocument } from "@/utils/clone";
import { measureAsync } from "@/utils/perfTrace";

type RawPayloadRecord = Record<string, number[]>;
type IpcPayloadRecord = Record<string, Uint8Array>;

export interface LoadedNativeProject {
  document: ProjectDocument;
  assetPayloads: RawPayloadRecord;
}

export interface AudioMetadataSource {
  assetId?: ID;
  path?: string;
  fileName?: string;
  bytes?: number[] | Uint8Array;
}

export interface AudioMetadataResult {
  assetId?: ID;
  path?: string;
  durationSec?: number;
  sampleRate?: number;
  channels?: number;
  error?: string;
}

export interface NormalizedAudioResult {
  bytes: Uint8Array;
  durationSec: number;
  sampleRate: number;
  channels: number;
}

export interface SampledTrackCurves {
  trackId: ID;
  pitch: number[];
  volume: number[];
}

export type NativeExportFormat = "bve" | "mtr";

export interface NativeBveExportOptions {
  format: "bve";
  sampleRate: number;
}

export interface NativeMtrExportOptions {
  format: "mtr";
  sampleRate: number;
  attenuationDistance: 16 | 32 | 64;
}

export type NativeExportOptions =
  | NativeBveExportOptions
  | NativeMtrExportOptions;

export function serializePayloadMap(
  assetPayloads: Map<ID, Uint8Array>,
): IpcPayloadRecord {
  return Object.fromEntries(assetPayloads.entries());
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

export async function readExternalFile(path: string): Promise<Uint8Array> {
  const bytes = await measureAsync(`read external file ${path}`, () =>
    invoke<number[]>("read_external_file", { path }),
  );
  return new Uint8Array(bytes);
}

export async function readAudioMetadataBatch(
  items: AudioMetadataSource[],
): Promise<AudioMetadataResult[]> {
  return measureAsync(`read audio metadata batch (${items.length})`, () =>
    invoke<AudioMetadataResult[]>("read_audio_metadata_batch", { items }),
  );
}

export async function normalizeAudioForPreview(
  source: AudioMetadataSource,
): Promise<NormalizedAudioResult> {
  const result = await measureAsync("normalize audio for preview", () =>
    invoke<Omit<NormalizedAudioResult, "bytes"> & { bytes: number[] | Uint8Array }>(
      "normalize_audio_for_preview",
      { source },
    ),
  );

  return {
    ...result,
    bytes: new Uint8Array(result.bytes),
  };
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

export async function exportNativeMtrProject(
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
  outputPath: string,
  options: NativeMtrExportOptions,
): Promise<void> {
  await invoke("export_mtr_project", {
    document: sanitizeProjectDocument(document),
    assetPayloads: serializePayloadMap(assetPayloads),
    outputPath,
    options,
  });
}
