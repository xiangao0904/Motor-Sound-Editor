import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

class TestAudioBuffer {
  constructor({ length, numberOfChannels, sampleRate }) {
    this.length = length;
    this.numberOfChannels = numberOfChannels;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(index) { return this.channels[index]; }
  copyToChannel(data, index) { this.channels[index].set(data); }
}
globalThis.AudioBuffer = TestAudioBuffer;
const compile = (path) => ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const fftUrl = moduleUrl(compile("src/services/spectrogram.ts"));
const spectralCode = compile("src/services/spectralEditing.ts").replace('from "./spectrogram"', `from "${fftUrl}"`);
const { renderSpectralEdit } = await import(moduleUrl(spectralCode));

const sampleRate = 16000;
const input = new TestAudioBuffer({ length: sampleRate * 2, numberOfChannels: 1, sampleRate });
for (let frame = 0; frame < input.length; frame += 1) {
  const time = frame / sampleRate;
  input.channels[0][frame] = 0.35 * Math.sin(2 * Math.PI * 500 * time) + 0.35 * Math.sin(2 * Math.PI * 1000 * time);
}
function amplitude(buffer, frequency, start, end) {
  let real = 0;
  let imaginary = 0;
  const begin = Math.round(start * sampleRate);
  const finish = Math.round(end * sampleRate);
  for (let index = begin; index < finish; index += 1) {
    const phase = 2 * Math.PI * frequency * index / sampleRate;
    real += buffer.channels[0][index] * Math.cos(phase);
    imaginary += buffer.channels[0][index] * Math.sin(phase);
  }
  return 2 * Math.hypot(real, imaginary) / (finish - begin);
}
const region = renderSpectralEdit(input, {
  regions: [{ startTime: 0.4, endTime: 1.6, lowFrequency: 450, highFrequency: 550 }],
  paths: [], reductionDb: 24, pathWidthSemitones: 3,
});
assert.ok(amplitude(region, 500, 0.8, 1.2) < 0.07, "Selected 500 Hz band was not reduced");
assert.ok(amplitude(region, 1000, 0.8, 1.2) > 0.30, "Unselected 1000 Hz band was damaged");
assert.ok(amplitude(region, 500, 0.05, 0.25) > 0.30, "Audio outside the time region was damaged");

const path = renderSpectralEdit(input, {
  regions: [],
  paths: [
    { points: [{ time: 0.2, frequency: 500 }, { time: 1.8, frequency: 500 }] },
    { points: [{ time: 0.2, frequency: 1000 }, { time: 1.8, frequency: 1000 }] },
  ], reductionDb: 24, pathWidthSemitones: 3,
});
assert.ok(amplitude(path, 500, 0.8, 1.2) < 0.07, "First path was not reduced");
assert.ok(amplitude(path, 1000, 0.8, 1.2) < 0.07, "Second path was not reduced");
console.log("Region, time boundary, and two simultaneous paths passed");
