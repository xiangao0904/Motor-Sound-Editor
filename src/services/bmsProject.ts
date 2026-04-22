import JSZip from "jszip";
import { invoke } from "@tauri-apps/api/core";

import type { ID } from "@/types/common";
import type { ProjectDocument, ProjectFile, TracksFile } from "@/types/project";
import type { AudioAsset } from "@/types/track";
import { sanitizeProjectDocument } from "@/utils/clone";

const PROJECT_FILE_NAME = "project.json";
const TRACKS_FILE_NAME = "tracks.json";

export interface LoadedBmsProject {
  document: ProjectDocument;
  assetPayloads: Map<ID, Uint8Array>;
}

export function fileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function projectNameFromPath(filePath: string): string {
  return fileNameFromPath(filePath).replace(/\.bms$/i, "");
}

export function ensureBmsExtension(filePath: string): string {
  return /\.bms$/i.test(filePath) ? filePath : `${filePath}.bms`;
}

export async function readFileModifiedAt(filePath: string): Promise<string> {
  try {
    const modifiedAt = await invoke<number | string>("read_bms_modified_at", {
      path: filePath,
    });
    return new Date(Number(modifiedAt)).toISOString();
  } catch {
    // Falling back to now keeps recent-project cards usable if metadata fails.
  }

  return new Date().toISOString();
}

export function createObjectUrl(bytes: Uint8Array, asset: AudioAsset): string {
  const mimeType = asset.format === "wav" ? "audio/wav" : "audio/ogg";
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return URL.createObjectURL(new Blob([buffer], { type: mimeType }));
}

export function stripRuntimeAssetFields(asset: AudioAsset): AudioAsset {
  const packagedAsset = { ...asset };
  delete packagedAsset.objectUrl;
  return packagedAsset;
}

export async function packBmsProject(
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
): Promise<Uint8Array> {
  const zip = new JSZip();
  const sanitizedDocument = sanitizeProjectDocument(document);
  const project = sanitizedDocument.project;
  const tracks = sanitizedDocument.tracks;

  zip.file(PROJECT_FILE_NAME, JSON.stringify(project, null, 2));
  zip.file(TRACKS_FILE_NAME, JSON.stringify(tracks, null, 2));

  tracks.assets.forEach((asset) => {
    const bytes = assetPayloads.get(asset.id);
    if (bytes) {
      zip.file(asset.packagedPath, bytes);
    }
  });

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function saveBmsProject(
  document: ProjectDocument,
  filePath: string,
  assetPayloads: Map<ID, Uint8Array>,
): Promise<void> {
  const archive = await packBmsProject(document, assetPayloads);
  const bytes = Array.from(archive);
  await invoke("write_bms_file", {
    path: filePath,
    bytes,
  });
}

export async function openBmsProject(filePath: string): Promise<LoadedBmsProject> {
  const archiveBytes = await invoke<number[]>("read_bms_file", {
    path: filePath,
  });
  const archive = new Uint8Array(archiveBytes);
  const zip = await JSZip.loadAsync(archive);
  const projectEntry = zip.file(PROJECT_FILE_NAME);
  const tracksEntry = zip.file(TRACKS_FILE_NAME);

  if (!projectEntry || !tracksEntry) {
    throw new Error("Invalid .bms file: project.json or tracks.json is missing.");
  }

  const project = JSON.parse(await projectEntry.async("string")) as ProjectFile;
  const tracks = JSON.parse(await tracksEntry.async("string")) as TracksFile;
  const assetPayloads = new Map<ID, Uint8Array>();

  for (const asset of tracks.assets) {
    const entry = zip.file(asset.packagedPath);
    if (!entry) continue;

    const bytes = await entry.async("uint8array");
    assetPayloads.set(asset.id, bytes);
    asset.objectUrl = createObjectUrl(bytes, asset);
  }

  return {
    document: { project, tracks },
    assetPayloads,
  };
}
