import { normalizeAudioForPreview } from "@/services/nativeInterop";

export interface AudioDecodeFallbackSource {
  path?: string;
  fileName?: string;
}

export interface DecodedAudioBytes {
  buffer: AudioBuffer;
  bytes: Uint8Array;
  normalized: boolean;
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
