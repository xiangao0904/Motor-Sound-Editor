import { fft } from "./spectrogram";

export interface SpectralPoint { time: number; frequency: number }
export interface SpectralRegion {
  startTime: number;
  endTime: number;
  lowFrequency: number;
  highFrequency: number;
}
export interface SpectralPath { points: SpectralPoint[] }
export interface SpectralEdit {
  regions: SpectralRegion[];
  paths: SpectralPath[];
  reductionDb: number;
  pathWidthSemitones: number;
}

const WINDOW = 2048;
const HOP = WINDOW / 4;

function smoothStep(value: number) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function pathFrequencyAt(points: SpectralPoint[], time: number): number | null {
  if (points.length < 2 || time < points[0].time || time > points[points.length - 1].time) return null;
  let left = 0;
  while (left < points.length - 2 && points[left + 1].time < time) left += 1;
  const first = points[left];
  const second = points[left + 1];
  const ratio = (time - first.time) / Math.max(second.time - first.time, 1e-6);
  return 2 ** (Math.log2(first.frequency) * (1 - ratio) + Math.log2(second.frequency) * ratio);
}

export function spectralGainAt(time: number, frequency: number, edit: SpectralEdit): number {
  const attenuation = 10 ** (-Math.max(0, Math.min(60, edit.reductionDb)) / 20);
  let coverage = 0;
  for (const region of edit.regions) {
    const timeFade = Math.min(
      smoothStep((time - region.startTime) / 0.025),
      smoothStep((region.endTime - time) / 0.025),
    );
    const low = Math.max(1, Math.min(region.lowFrequency, region.highFrequency));
    const high = Math.max(low, Math.max(region.lowFrequency, region.highFrequency));
    const feather = Math.max(0.06, Math.log2(high / low) * 0.12);
    const frequencyFade = Math.min(
      smoothStep(Math.log2(frequency / low) / feather + 0.5),
      smoothStep(Math.log2(high / frequency) / feather + 0.5),
    );
    coverage = Math.max(coverage, timeFade * frequencyFade);
  }
  const halfWidth = Math.max(0.1, Math.min(24, edit.pathWidthSemitones)) / 2;
  for (const path of edit.paths) {
    const center = pathFrequencyAt(path.points, time);
    if (!center) continue;
    const edgeTime = Math.min(time - path.points[0].time, path.points[path.points.length - 1].time - time);
    const timeFade = smoothStep(edgeTime / 0.025);
    const distance = Math.abs(12 * Math.log2(frequency / center));
    const frequencyFade = 1 - smoothStep((distance - halfWidth * 0.7) / Math.max(halfWidth * 0.6, 0.15));
    coverage = Math.max(coverage, timeFade * frequencyFade);
  }
  return 1 - coverage * (1 - attenuation);
}

export function renderSpectralEdit(source: AudioBuffer, edit: SpectralEdit): AudioBuffer {
  const output = new AudioBuffer({ length: source.length, numberOfChannels: source.numberOfChannels, sampleRate: source.sampleRate });
  if (edit.regions.length === 0 && edit.paths.length === 0) {
    for (let channel = 0; channel < source.numberOfChannels; channel += 1) output.copyToChannel(source.getChannelData(channel), channel);
    return output;
  }
  const window = Float64Array.from({ length: WINDOW }, (_, index) => 0.5 - 0.5 * Math.cos(2 * Math.PI * index / WINDOW));
  const weights = new Float64Array(source.length);
  for (let center = 0; center < source.length + WINDOW / 2; center += HOP) {
    const start = center - WINDOW / 2;
    for (let index = 0; index < WINDOW; index += 1) {
      const frame = start + index;
      if (frame >= 0 && frame < weights.length) weights[frame] += window[index] ** 2;
    }
  }
  const real = new Float64Array(WINDOW);
  const imaginary = new Float64Array(WINDOW);
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel);
    const target = output.getChannelData(channel);
    for (let center = 0; center < source.length + WINDOW / 2; center += HOP) {
      const start = center - WINDOW / 2;
      for (let index = 0; index < WINDOW; index += 1) {
        real[index] = (input[start + index] ?? 0) * window[index];
        imaginary[index] = 0;
      }
      fft(real, imaginary);
      const time = Math.min(center, source.length - 1) / source.sampleRate;
      for (let bin = 0; bin <= WINDOW / 2; bin += 1) {
        const frequency = bin * source.sampleRate / WINDOW;
        if (frequency <= 0) continue;
        const gain = spectralGainAt(time, frequency, edit);
        real[bin] *= gain;
        imaginary[bin] *= gain;
        if (bin > 0 && bin < WINDOW / 2) {
          real[WINDOW - bin] *= gain;
          imaginary[WINDOW - bin] *= gain;
        }
      }
      for (let index = 0; index < WINDOW; index += 1) imaginary[index] = -imaginary[index];
      fft(real, imaginary);
      for (let index = 0; index < WINDOW; index += 1) {
        const frame = start + index;
        if (frame >= 0 && frame < target.length) target[frame] += real[index] / WINDOW * window[index];
      }
    }
    for (let index = 0; index < target.length; index += 1) target[index] /= Math.max(weights[index], 1e-9);
  }
  return output;
}
