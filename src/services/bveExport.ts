import JSZip from "jszip";
import { writeFile } from "@tauri-apps/plugin-fs";

import type { ID } from "@/types/common";
import type { ProjectDocument } from "@/types/project";
import type {
  AudioAsset,
  CurveKind,
  CurveSetKind,
  Track,
} from "@/types/track";
import { sampleCurve } from "@/utils/curves";

export type ExportFormat = "bve";

export interface BveExportOptions {
  format: ExportFormat;
  sampleRate: number;
}

interface ExportableTrack {
  track: Track;
  asset: AudioAsset;
  bytes: Uint8Array;
  fileName: string;
}

const CSV_HEADER = "bvets motor noise table 0.01";

function safeZipSegment(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || "Motor Sound Export";
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";

  return value
    .toFixed(6)
    .replace(/\.?0+$/u, "")
    .replace(/^-0$/u, "0");
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
          bytes,
          fileName: `sound_${track.id}.wav`,
        },
      ];
    })
    .map((item, index) => ({
      ...item,
      fileName: `sound_${index + 1}.wav`,
    }));
}

export function hasOggExportTracks(
  document: ProjectDocument,
  assetPayloads: Map<ID, Uint8Array>,
): boolean {
  return exportableTracks(document, assetPayloads).some(
    ({ asset }) => asset.format === "ogg",
  );
}

function collectSpeeds(
  tracks: ExportableTrack[],
  curveSet: CurveSetKind,
  kind: CurveKind,
): number[] {
  const speeds = new Set<number>();

  tracks.forEach(({ track }) => {
    track.curveSets[curveSet][kind].keyframes.forEach((keyframe) => {
      if (Number.isFinite(keyframe.speed)) {
        speeds.add(Number(keyframe.speed.toFixed(6)));
      }
    });
  });

  if (speeds.size === 0) {
    speeds.add(0);
  }

  return [...speeds].sort((a, b) => a - b);
}

function createMotorNoiseCsv(
  tracks: ExportableTrack[],
  curveSet: CurveSetKind,
  kind: CurveKind,
): string {
  const speeds = collectSpeeds(tracks, curveSet, kind);
  const rows = speeds.map((speed) => {
    const values = tracks.map(({ track }) =>
      sampleCurve(track.curveSets[curveSet][kind], speed),
    );

    return [speed, ...values].map(formatNumber).join(",");
  });

  return [CSV_HEADER, ...rows].join("\r\n");
}

async function decodeAudioBuffer(bytes: Uint8Array): Promise<AudioBuffer> {
  const context = new AudioContext();

  try {
    return await context.decodeAudioData(bytesToArrayBuffer(bytes));
  } finally {
    if (context.state !== "closed") {
      await context.close();
    }
  }
}

async function resampleAudioBuffer(
  sourceBuffer: AudioBuffer,
  sampleRate: number,
): Promise<AudioBuffer> {
  if (sourceBuffer.sampleRate === sampleRate) {
    return sourceBuffer;
  }

  const length = Math.max(1, Math.ceil(sourceBuffer.duration * sampleRate));
  const offlineContext = new OfflineAudioContext(
    sourceBuffer.numberOfChannels,
    length,
    sampleRate,
  );
  const source = offlineContext.createBufferSource();
  source.buffer = sourceBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  return offlineContext.startRendering();
}

function encodePcm16Wav(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels;
  const samples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = buffer.sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const output = new ArrayBuffer(44 + dataSize);
  const view = new DataView(output);
  const channelData = Array.from({ length: channels }, (_, index) =>
    buffer.getChannelData(index),
  );

  function writeString(offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
      const sample = Math.max(
        -1,
        Math.min(1, channelData[channelIndex][sampleIndex] ?? 0),
      );
      const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, pcm, true);
      offset += bytesPerSample;
    }
  }

  return new Uint8Array(output);
}

async function createWavBytes(
  bytes: Uint8Array,
  sampleRate: number,
): Promise<Uint8Array> {
  const decoded = await decodeAudioBuffer(bytes);
  const resampled = await resampleAudioBuffer(decoded, sampleRate);
  return encodePcm16Wav(resampled);
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

  const rootName = safeZipSegment(document.project.meta.name);
  const zip = new JSZip();
  const root = zip.folder(rootName);
  const motorNoise = root?.folder("motornoise");
  const sound = root?.folder("sound");

  if (!root || !motorNoise || !sound) {
    throw new Error("Could not create BVE export archive.");
  }

  root.file(
    "vehicle.txt",
    "BveTs Vehicle 1.00\r\nSound = sound\\Sound.txt\r\nMotorNoise = motornoise\\motornoise.txt\r\n",
  );
  motorNoise.file(
    "motornoise.txt",
    "[Power]\r\nVolume = powervol.csv\r\nFrequency = powerfreq.csv\r\n\r\n[Brake]\r\nVolume = brakevol.csv\r\nFrequency = brakefreq.csv\r\n",
  );
  motorNoise.file("powerfreq.csv", createMotorNoiseCsv(tracks, "traction", "pitch"));
  motorNoise.file("powervol.csv", createMotorNoiseCsv(tracks, "traction", "volume"));
  motorNoise.file("brakefreq.csv", createMotorNoiseCsv(tracks, "brake", "pitch"));
  motorNoise.file("brakevol.csv", createMotorNoiseCsv(tracks, "brake", "volume"));
  sound.file(
    "Sound.txt",
    [
      "Version 1.0",
      "",
      "[Run]",
      "",
      "[Motor]",
      ...tracks.map(({ fileName }, index) => `${index} = ${fileName}`),
      "",
    ].join("\r\n"),
  );

  for (const track of tracks) {
    sound.file(track.fileName, await createWavBytes(track.bytes, options.sampleRate));
  }

  const archive = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  await writeFile(outputPath, archive);
}
