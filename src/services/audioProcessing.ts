import { normalizeAudioForPreview } from "@/services/nativeInterop";

export type LoopRenderMode = "normal" | "pingpong";

export interface DecodedAudio {
  buffer: AudioBuffer;
  objectUrl: string;
}

export interface PitchFlattenReference {
  startSec: number;
  endSec: number;
  curve?: PitchCurveShape;
}

export interface PitchCurveShape {
  mode: "line" | "bezier";
  control1?: { timeRatio: number; semitones: number };
  control2?: { timeRatio: number; semitones: number };
}

function cubicBezier(a: number, b: number, c: number, d: number, t: number) {
  const inverse = 1 - t;
  return inverse ** 3 * a + 3 * inverse ** 2 * t * b +
    3 * inverse * t ** 2 * c + t ** 3 * d;
}

export function pitchCurveSemitonesAt(
  progress: number,
  endSemitones: number,
  curve?: PitchCurveShape,
) {
  const x = Math.min(1, Math.max(0, progress));
  if (curve?.mode !== "bezier" || !curve.control1 || !curve.control2) {
    return endSemitones * x;
  }
  const x1 = Math.min(1, Math.max(0, curve.control1.timeRatio));
  const x2 = Math.min(1, Math.max(x1, curve.control2.timeRatio));
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const middle = (low + high) / 2;
    if (cubicBezier(0, x1, x2, 1, middle) < x) low = middle;
    else high = middle;
  }
  return cubicBezier(
    0,
    curve.control1.semitones,
    curve.control2.semitones,
    endSemitones,
    (low + high) / 2,
  );
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext() {
  sharedAudioContext ??= new AudioContext();
  return sharedAudioContext;
}

export async function decodeAudioBytes(bytes: Uint8Array): Promise<AudioBuffer> {
  const copy = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  return getAudioContext().decodeAudioData(copy);
}

export interface AudioDecodeFallbackSource {
  path?: string;
  fileName?: string;
}

export interface DecodedAudioBytes {
  buffer: AudioBuffer;
  bytes: Uint8Array;
  normalized: boolean;
}

export async function decodeAudioBytesWithNativeFallback(
  bytes: Uint8Array,
  source: AudioDecodeFallbackSource = {},
): Promise<DecodedAudioBytes> {
  try {
    return {
      buffer: await decodeAudioBytes(bytes),
      bytes,
      normalized: false,
    };
  } catch (browserError) {
    try {
      const normalized = await normalizeAudioForPreview({
        ...source,
        bytes,
      });
      return {
        buffer: await decodeAudioBytes(normalized.bytes),
        bytes: normalized.bytes,
        normalized: true,
      };
    } catch (nativeError) {
      console.error("Native audio preview normalization failed", {
        browserError,
        nativeError,
      });
      throw nativeError;
    }
  }
}

function createBufferLike(source: AudioBuffer, frameCount: number) {
  return getAudioContext().createBuffer(
    source.numberOfChannels,
    Math.max(1, frameCount),
    source.sampleRate,
  );
}

function copySample(
  source: Float32Array,
  sourceIndex: number,
  fallback = 0,
): number {
  return source[sourceIndex] ?? fallback;
}

function sampleLinear(source: Float32Array, position: number): number {
  const safePosition = Math.min(Math.max(position, 0), source.length - 1);
  const left = Math.floor(safePosition);
  const right = Math.min(left + 1, source.length - 1);
  const mix = safePosition - left;
  return copySample(source, left) * (1 - mix) + copySample(source, right) * mix;
}

export function renderLoopAudio(
  source: AudioBuffer,
  startSec: number,
  endSec: number,
  mode: LoopRenderMode,
  fadeMs: number,
): AudioBuffer {
  const startFrame = Math.min(
    Math.max(Math.floor(startSec * source.sampleRate), 0),
    source.length - 1,
  );
  const endFrame = Math.min(
    Math.max(Math.floor(endSec * source.sampleRate), startFrame + 1),
    source.length,
  );
  const segmentLength = Math.max(1, endFrame - startFrame);
  const fadeFrames = Math.min(
    Math.max(0, Math.floor((fadeMs / 1000) * source.sampleRate) || 0),
    Math.floor(segmentLength / 4),
  );
  const outputLength = mode === "pingpong"
    ? Math.max(1, segmentLength * 2 - 2)
    : segmentLength - fadeFrames;
  const output = createBufferLike(source, outputLength);

  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel);
    const target = output.getChannelData(channel);

    if (mode === "pingpong") {
      for (let index = 0; index < outputLength; index += 1) {
        const sourceOffset = index < segmentLength
          ? index
          : outputLength - index;
        target[index] = copySample(input, startFrame + sourceOffset);
      }
    } else {
      for (let index = 0; index < outputLength; index += 1) {
        target[index] = copySample(input, startFrame + index);
      }
      for (let index = 0; index < fadeFrames; index += 1) {
        const mix = (index + 1) / (fadeFrames + 1);
        const tail = copySample(input, endFrame - fadeFrames + index);
        const head = copySample(input, startFrame + index);
        target[index] = tail * (1 - mix) + head * mix;
      }
    }
  }

  return output;
}

export function flattenPitchAudio(
  source: AudioBuffer,
  totalSemitones: number,
  reference?: PitchFlattenReference,
): AudioBuffer {
  const output = createBufferLike(source, source.length);
  if (source.length <= 1) return output;
  const duration = (source.length - 1) / source.sampleRate;
  const startSec = Math.min(Math.max(reference?.startSec ?? 0, 0), duration);
  const endSec = Math.min(Math.max(reference?.endSec ?? duration, startSec), duration);
  const spanSec = Math.max(endSec - startSec, 1 / source.sampleRate);
  const safeSemitones = Number.isFinite(totalSemitones)
    ? Math.min(72, Math.max(-72, totalSemitones))
    : 0;
  // The visible path is linear in time and log frequency. Invert the number
  // of cycles along that path so the modeled pitch becomes constant while
  // retaining the clip length.
  const curveTable = new Float64Array(2049);
  for (let index = 0; index < curveTable.length; index += 1) {
    const semitones = pitchCurveSemitonesAt(index / 2048, safeSemitones, reference?.curve);
    curveTable[index] = 2 ** (Math.min(84, Math.max(-84, semitones)) / 12);
  }
  const cumulativeCycles = new Float64Array(source.length);
  for (let frame = 1; frame < source.length; frame += 1) {
    const timeSec = (frame - 0.5) / source.sampleRate;
    const progress = Math.min(1, Math.max(0, (timeSec - startSec) / spanSec));
    const tablePosition = progress * 2048;
    const left = Math.floor(tablePosition);
    const right = Math.min(2048, left + 1);
    const mix = tablePosition - left;
    const relativeFrequency = curveTable[left] * (1 - mix) + curveTable[right] * mix;
    cumulativeCycles[frame] = cumulativeCycles[frame - 1] + relativeFrequency;
  }

  const sourcePositions = new Float64Array(source.length);
  const totalCycles = cumulativeCycles[source.length - 1];
  let sourceFrame = 0;
  for (let frame = 0; frame < source.length; frame += 1) {
    const targetCycles = (frame / (source.length - 1)) * totalCycles;
    while (
      sourceFrame < source.length - 2 &&
      cumulativeCycles[sourceFrame + 1] < targetCycles
    ) {
      sourceFrame += 1;
    }
    const frameCycles = cumulativeCycles[sourceFrame + 1] - cumulativeCycles[sourceFrame];
    sourcePositions[frame] = sourceFrame +
      (targetCycles - cumulativeCycles[sourceFrame]) / frameCycles;
  }

  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel);
    const target = output.getChannelData(channel);
    for (let index = 0; index < target.length; index += 1) {
      target[index] = sampleLinear(input, sourcePositions[index]);
    }
  }

  return output;
}

export function encodeWav(buffer: AudioBuffer): Uint8Array {
  const bytesPerSample = 2;
  const dataLength =
    buffer.length * buffer.numberOfChannels * bytesPerSample;
  const bytes = new ArrayBuffer(44 + dataLength);
  const view = new DataView(bytes);
  let offset = 0;

  function writeString(value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  }

  function writeUint32(value: number) {
    view.setUint32(offset, value, true);
    offset += 4;
  }

  function writeUint16(value: number) {
    view.setUint16(offset, value, true);
    offset += 2;
  }

  writeString("RIFF");
  writeUint32(36 + dataLength);
  writeString("WAVE");
  writeString("fmt ");
  writeUint32(16);
  writeUint16(1);
  writeUint16(buffer.numberOfChannels);
  writeUint32(buffer.sampleRate);
  writeUint32(buffer.sampleRate * buffer.numberOfChannels * bytesPerSample);
  writeUint16(buffer.numberOfChannels * bytesPerSample);
  writeUint16(16);
  writeString("data");
  writeUint32(dataLength);

  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );

  for (let frame = 0; frame < buffer.length; frame += 1) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame] ?? 0));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += bytesPerSample;
    }
  }

  return new Uint8Array(bytes);
}

export function createAudioObjectUrl(bytes: Uint8Array, type = "audio/wav") {
  return URL.createObjectURL(new Blob([bytes], { type }));
}
