import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import ts from "typescript";

const source = readFileSync(resolve("src/services/spectrogram.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { computeSpectrogram } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const sampleRate = 44100;
const samples = Float32Array.from({ length: sampleRate * 2 }, (_, frame) =>
  Math.sin((2 * Math.PI * 440 * frame) / sampleRate),
);
const buffer = { sampleRate, getChannelData: () => samples };
const start = performance.now();
const spectrogram = computeSpectrogram(buffer);
const elapsed = performance.now() - start;
assert.equal(spectrogram.columns.length, 180);
const middle = spectrogram.columns[90];
const strongestBin = middle.magnitudes.indexOf(Math.max(...middle.magnitudes));
const strongestHz = spectrogram.frequencies[strongestBin];
assert.ok(Math.abs(strongestHz - 440) < 35, `Unexpected strongest frequency: ${strongestHz} Hz`);
console.log(`2 s spectrum: ${elapsed.toFixed(1)} ms; strongest bin ${strongestHz.toFixed(1)} Hz`);
