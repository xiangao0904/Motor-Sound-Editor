export interface SpectrogramData {
  columns: Array<{ time: number; magnitudes: number[] }>;
  frequencies: number[];
  minDb: number;
  maxDb: number;
}

export function spectrogramColor(value: number, preview: boolean) {
  const intensity = Math.max(0, Math.min(1, value));
  const low = preview ? { r: 32, g: 31, b: 43 } : { r: 24, g: 36, b: 47 };
  const mid = preview ? { r: 112, g: 101, b: 130 } : { r: 92, g: 118, b: 134 };
  const high = preview ? { r: 244, g: 238, b: 247 } : { r: 240, g: 245, b: 243 };
  const from = intensity < 0.55 ? low : mid;
  const to = intensity < 0.55 ? mid : high;
  const blend = intensity < 0.55 ? intensity / 0.55 : (intensity - 0.55) / 0.45;
  return `rgb(${Math.round(from.r + (to.r - from.r) * blend)},${Math.round(from.g + (to.g - from.g) * blend)},${Math.round(from.b + (to.b - from.b) * blend)})`;
}

const MIN_FREQUENCY = 80;
const MAX_FREQUENCY = 4000;
const WINDOW_SIZE = 2048;
const FREQUENCY_BINS = 112;
const MAX_COLUMNS = 180;

export function fft(real: Float64Array, imaginary: Float64Array) {
  const length = real.length;
  let reversed = 0;
  for (let index = 1; index < length; index += 1) {
    let bit = length >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }

  for (let size = 2; size <= length; size *= 2) {
    const angle = (-2 * Math.PI) / size;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < length; start += size) {
      let rotationReal = 1;
      let rotationImaginary = 0;
      for (let offset = 0; offset < size / 2; offset += 1) {
        const left = start + offset;
        const right = left + size / 2;
        const combinedReal = real[right] * rotationReal - imaginary[right] * rotationImaginary;
        const combinedImaginary = real[right] * rotationImaginary + imaginary[right] * rotationReal;
        real[right] = real[left] - combinedReal;
        imaginary[right] = imaginary[left] - combinedImaginary;
        real[left] += combinedReal;
        imaginary[left] += combinedImaginary;
        const nextReal = rotationReal * stepReal - rotationImaginary * stepImaginary;
        rotationImaginary = rotationReal * stepImaginary + rotationImaginary * stepReal;
        rotationReal = nextReal;
      }
    }
  }
}

export function computeSpectrogram(buffer: AudioBuffer, maxFrequency = MAX_FREQUENCY, frequencyBins = FREQUENCY_BINS, minFrequency = MIN_FREQUENCY): SpectrogramData {
  const samples = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const columnCount = Math.min(MAX_COLUMNS, Math.max(1, Math.floor(samples.length / 256)));
  const minLog = Math.log2(minFrequency);
  const maxLog = Math.log2(Math.min(maxFrequency, sampleRate / 2));
  const frequencies = Array.from({ length: frequencyBins }, (_, index) =>
    2 ** (minLog + (index / (frequencyBins - 1)) * (maxLog - minLog)),
  );
  const window = Float64Array.from({ length: WINDOW_SIZE }, (_, index) =>
    0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (WINDOW_SIZE - 1)),
  );
  const real = new Float64Array(WINDOW_SIZE);
  const imaginary = new Float64Array(WINDOW_SIZE);
  const power = new Float64Array(WINDOW_SIZE / 2 + 1);
  const columns: SpectrogramData["columns"] = [];
  let maxDb = -120;

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const ratio = columnCount === 1 ? 0 : columnIndex / (columnCount - 1);
    const centerFrame = Math.round(ratio * (samples.length - 1));
    const startFrame = Math.max(0, Math.min(centerFrame - WINDOW_SIZE / 2, samples.length - WINDOW_SIZE));
    for (let index = 0; index < WINDOW_SIZE; index += 1) {
      real[index] = (samples[startFrame + index] ?? 0) * window[index];
      imaginary[index] = 0;
    }
    fft(real, imaginary);
    for (let index = 0; index < power.length; index += 1) {
      power[index] = (real[index] ** 2 + imaginary[index] ** 2) / WINDOW_SIZE;
    }

    const magnitudes = frequencies.map((frequency) => {
      const bin = Math.min(power.length - 1, (frequency * WINDOW_SIZE) / sampleRate);
      const left = Math.floor(bin);
      const mix = bin - left;
      const value = power[left] * (1 - mix) + power[Math.min(left + 1, power.length - 1)] * mix;
      const db = 10 * Math.log10(Math.max(value, 1e-12));
      maxDb = Math.max(maxDb, db);
      return db;
    });
    columns.push({ time: centerFrame / sampleRate, magnitudes });
  }

  return { columns, frequencies, minDb: maxDb - 68, maxDb };
}
