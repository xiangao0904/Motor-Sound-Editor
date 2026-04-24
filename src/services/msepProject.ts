import { invoke } from "@tauri-apps/api/core";

import type { ID } from "@/types/common";
import type { ProjectDocument } from "@/types/project";
import type { AudioAsset } from "@/types/track";
import {
  deserializePayloadRecord,
  openNativeMsepProject,
  saveNativeMsepProject,
} from "@/services/nativeInterop";

export interface LoadedMsepProject {
  document: ProjectDocument;
  assetPayloads: Map<ID, Uint8Array>;
}

export function fileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function projectNameFromPath(filePath: string): string {
  return fileNameFromPath(filePath).replace(/\.msep$/i, "");
}

export function ensureMsepExtension(filePath: string): string {
  return /\.msep$/i.test(filePath) ? filePath : `${filePath}.msep`;
}

export function isMsepPath(filePath: string): boolean {
  return /\.msep$/i.test(filePath);
}

export async function readFileModifiedAt(filePath: string): Promise<string> {
  try {
    const modifiedAt = await invoke<number | string>("read_msep_modified_at", {
      path: filePath,
    });
    return new Date(Number(modifiedAt)).toISOString();
  } catch {
    // Falling back to now keeps recent-project cards usable if metadata fails.
  }

  return new Date().toISOString();
}

export function createObjectUrl(
  bytes: Uint8Array,
  asset: Pick<AudioAsset, "format">,
): string {
  const mimeType = asset.format === "wav" ? "audio/wav" : "audio/ogg";
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}

export function revokeAssetObjectUrl(asset: AudioAsset) {
  if (!asset.objectUrl) return;

  URL.revokeObjectURL(asset.objectUrl);
  delete asset.objectUrl;
}

export function revokeDocumentObjectUrls(document: ProjectDocument | null) {
  document?.tracks.assets.forEach(revokeAssetObjectUrl);
}

export function restoreDocumentObjectUrls(
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
) {
  document.tracks.assets.forEach((asset) => {
    if (asset.objectUrl) return;

    const bytes = assetPayloads.get(asset.id);
    if (bytes) {
      asset.objectUrl = createObjectUrl(bytes, asset);
    }
  });

  return document;
}

export function stripRuntimeAssetFields(asset: AudioAsset): AudioAsset {
  const packagedAsset = { ...asset };
  delete packagedAsset.objectUrl;
  return packagedAsset;
}

export async function saveMsepProject(
  document: ProjectDocument,
  filePath: string,
  assetPayloads: Map<ID, Uint8Array>,
): Promise<void> {
  await saveNativeMsepProject(filePath, document, assetPayloads);
}

export async function openMsepProject(filePath: string): Promise<LoadedMsepProject> {
  const loaded = await openNativeMsepProject(filePath);
  const assetPayloads = deserializePayloadRecord(loaded.assetPayloads);
  loaded.document.tracks.assets.forEach((asset) => {
    const bytes = assetPayloads.get(asset.id);
    if (bytes) {
      asset.objectUrl = createObjectUrl(bytes, asset);
    }
  });

  return {
    document: loaded.document,
    assetPayloads,
  };
}
