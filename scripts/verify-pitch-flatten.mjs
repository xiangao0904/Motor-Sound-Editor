import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

class TestAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(channel) {
    return this.data[channel];
  }
}

globalThis.AudioContext = class {
  createBuffer(channels, length, sampleRate) {
    return new TestAudioBuffer(channels, length, sampleRate);
  }
};

const source = readFileSync(resolve("src/services/audioProcessing.ts"), "utf8");
const withoutNativeImport = source.replace(
  /^import \{ normalizeAudioForPreview \} from "@\/services\/nativeInterop";\r?\n/m,
  "",
);
assert.notEqual(withoutNativeImport, source, "Native import removal failed");
const compiled = ts.transpileModule(withoutNativeImport, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { flattenPitchAudio, pitchCurveSemitonesAt } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function makeChirp(startHz, endHz, curve = { mode: "line" }) {
  const sampleRate = 22050;
  const seconds = 2;
  const buffer = new TestAudioBuffer(1, sampleRate * seconds + 1, sampleRate);
  const samples = buffer.getChannelData(0);
  const endSemitones = 12 * Math.log2(endHz / startHz);
  let phase = 0;
  let frequencySum = 0;
  for (let frame = 0; frame < samples.length; frame += 1) {
    const time = frame / sampleRate;
    const semitones = pitchCurveSemitonesAt(time / seconds, endSemitones, curve);
    const frequency = startHz * 2 ** (semitones / 12);
    frequencySum += frequency;
    phase += (2 * Math.PI * frequency) / sampleRate;
    samples[frame] = Math.sin(phase);
  }
  return { buffer, averageHz: frequencySum / samples.length };
}

function frequencyNear(buffer, centerSec) {
  const samples = buffer.getChannelData(0);
  const halfWindow = Math.round(buffer.sampleRate * 0.1);
  const center = Math.round(centerSec * buffer.sampleRate);
  let crossings = 0;
  for (let frame = center - halfWindow + 1; frame <= center + halfWindow; frame += 1) {
    if (samples[frame - 1] <= 0 && samples[frame] > 0) crossings += 1;
  }
  return crossings / (2 * halfWindow / buffer.sampleRate);
}

const cases = [
  [220, 660, { mode: "line" }],
  [660, 220, { mode: "line" }],
  [220, 660, {
    mode: "bezier",
    control1: { timeRatio: 0.25, semitones: 18 },
    control2: { timeRatio: 0.75, semitones: -3 },
  }],
];

for (const [startHz, endHz, curve] of cases) {
  const { buffer: input, averageHz } = makeChirp(startHz, endHz, curve);
  const output = flattenPitchAudio(input, 12 * Math.log2(endHz / startHz), {
    startSec: 0,
    endSec: 2,
    curve,
  });
  const frequencies = [0.25, 1, 1.75].map((time) => frequencyNear(output, time));
  assert.equal(output.length, input.length, "Clip length changed");
  assert.ok(
    Math.max(...frequencies) - Math.min(...frequencies) < 15,
    `Pitch was not flat: ${frequencies.join(", ")} Hz`,
  );
  assert.ok(
    frequencies.every((frequency) => Math.abs(frequency - averageHz) < 15),
    `Unexpected flattened pitch: ${frequencies.join(", ")} Hz`,
  );
  console.log(`${curve.mode} ${startHz} → ${endHz} Hz: ${frequencies.join(", ")} Hz`);
}

assert.equal(pitchCurveSemitonesAt(0.25, 12, { mode: "line" }), 3);

const curved = cases[2][2];
const cubic = (a, b, c, d, t) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;
const curvedEnd = 12 * Math.log2(660 / 220);
for (const parameter of [0.1, 0.4, 0.9]) {
  const x = cubic(0, curved.control1.timeRatio, curved.control2.timeRatio, 1, parameter);
  const expectedY = cubic(0, curved.control1.semitones, curved.control2.semitones, curvedEnd, parameter);
  assert.ok(
    Math.abs(pitchCurveSemitonesAt(x, curvedEnd, curved) - expectedY) < 0.001,
    "Audio correction diverged from the Bézier path",
  );
}

const { buffer: unchanged } = makeChirp(220, 660);
const identity = flattenPitchAudio(unchanged, 0);
let largestDifference = 0;
for (let frame = 0; frame < unchanged.length; frame += 1) {
  largestDifference = Math.max(
    largestDifference,
    Math.abs(unchanged.getChannelData(0)[frame] - identity.getChannelData(0)[frame]),
  );
}
assert.ok(largestDifference < 1e-6, `Zero correction changed the signal: ${largestDifference}`);
