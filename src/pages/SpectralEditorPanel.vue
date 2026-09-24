<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { createAudioObjectUrl, encodeWav } from "@/services/audioProcessing";
import { renderSpectralEdit, type SpectralPath, type SpectralPoint, type SpectralRegion } from "@/services/spectralEditing";
import { computeSpectrogram, spectrogramColor, type SpectrogramData } from "@/services/spectrogram";
import { useI18nStore } from "@/stores/i18n";

const props = defineProps<{ buffer: AudioBuffer | null; sourceUrl: string; spectrogram: SpectrogramData | null; disabled: boolean }>();
const emit = defineEmits<{ apply: [bytes: Uint8Array] }>();
const i18n = useI18nStore();
function t(key: string, values: Record<string, string | number> = {}) {
  return i18n.t(`audio.${key}`).replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
const mode = ref<"region" | "path">("region");
const regions = ref<SpectralRegion[]>([]);
const paths = ref<SpectralPath[]>([]);
const selectionOrder = ref<Array<"region" | "path">>([]);
const reductionDb = ref(24);
const pathWidthSemitones = ref(3);
const draftRegion = ref<SpectralRegion | null>(null);
const draftPath = ref<SpectralPath | null>(null);
const sourceCanvas = ref<HTMLCanvasElement | null>(null);
const resultCanvas = ref<HTMLCanvasElement | null>(null);
const sourceAudio = ref<HTMLAudioElement | null>(null);
const resultAudio = ref<HTMLAudioElement | null>(null);
const previewBuffer = shallowRef<AudioBuffer | null>(null);
const previewBytes = ref<Uint8Array | null>(null);
const previewUrl = ref("");
const listenTo = ref<"current" | "result">("current");
const isPlaying = ref(false);
const isRendering = ref(false);
const error = ref("");
let renderTimer: number | null = null;
let drawFrame: number | null = null;
let renderVersion = 0;
let pointerId: number | null = null;
let regionDrag: { index: number; handle: "start" | "end" | "low" | "high" | "move"; point: SpectralPoint; original: SpectralRegion } | null = null;
const minFrequency = 20;
const maxFrequency = computed(() => Math.min(12000, (props.buffer?.sampleRate ?? 44100) / 2));
const viewRange = computed(() => ({ min: minFrequency, max: maxFrequency.value }));
const previewSpectrogram = computed(() => previewBuffer.value ? computeSpectrogram(previewBuffer.value, maxFrequency.value, 256, minFrequency) : null);
const spectrogramCache = new WeakMap<SpectrogramData, Map<string, HTMLCanvasElement>>();

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function frequencyY(frequency: number, height: number) {
  const { min, max } = viewRange.value;
  return height * (1 - Math.log2(clamp(frequency, min, max) / min) / Math.log2(max / min));
}
function eventPoint(event: PointerEvent, canvas: HTMLCanvasElement): SpectralPoint {
  const rect = canvas.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  const { min, max } = viewRange.value;
  return { time: x * (props.buffer?.duration ?? 0), frequency: min * (max / min) ** (1 - y) };
}
function draw(canvas: HTMLCanvasElement | null, data: SpectrogramData | null, result: boolean) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const scale = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.fillStyle = result ? "#201f2b" : "#18242f";
  context.fillRect(0, 0, width, height);
  if (data) {
    let variants = spectrogramCache.get(data);
    if (!variants) { variants = new Map(); spectrogramCache.set(data, variants); }
    const key = `${width}:${height}:${result}:${viewRange.value.min}:${viewRange.value.max}`;
    let image = variants.get(key);
    if (!image) {
      image = document.createElement("canvas");
      image.width = width;
      image.height = height;
      const imageContext = image.getContext("2d");
      if (imageContext) {
        imageContext.fillStyle = result ? "#201f2b" : "#18242f";
        imageContext.fillRect(0, 0, width, height);
        const columnWidth = width / Math.max(1, data.columns.length);
        data.columns.forEach((column, columnIndex) => {
          data.frequencies.forEach((frequency, bin) => {
            if (frequency < viewRange.value.min || frequency > viewRange.value.max) return;
            const normalized = clamp(((column.magnitudes[bin] ?? data.minDb) - data.minDb) / Math.max(1, data.maxDb - data.minDb), 0, 1) ** 1.6;
            const next = data.frequencies[bin + 1] ?? frequency * (data.frequencies[1] / data.frequencies[0]);
            const top = frequencyY(next, height);
            const bottom = frequencyY(frequency, height);
            imageContext.fillStyle = spectrogramColor(normalized, result);
            const x = Math.floor(columnIndex * columnWidth);
            const nextX = Math.ceil((columnIndex + 1) * columnWidth);
            imageContext.fillRect(x, Math.floor(top), Math.max(1, nextX - x), Math.max(1, Math.ceil(bottom - top)));
          });
        });
      }
      variants.set(key, image);
    }
    context.drawImage(image, 0, 0, width, height);
  }
  if (result) return;
  const duration = Math.max(0.001, props.buffer?.duration ?? 0);
  context.fillStyle = "rgba(255, 205, 125, 0.22)";
  context.strokeStyle = "#ffcd7d";
  context.lineWidth = 2;
  for (const region of [...regions.value, ...(draftRegion.value ? [draftRegion.value] : [])]) {
    const x = region.startTime / duration * width;
    const y = frequencyY(region.highFrequency, height);
    const w = (region.endTime - region.startTime) / duration * width;
    const h = frequencyY(region.lowFrequency, height) - y;
    context.fillRect(x, y, w, h);
    context.strokeRect(x, y, w, h);
  }
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const path of [...paths.value, ...(draftPath.value ? [draftPath.value] : [])]) {
    if (!path.points.length) continue;
    context.beginPath();
    path.points.forEach((point, index) => {
      const x = point.time / duration * width;
      const y = frequencyY(point.frequency, height);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = "rgba(255, 205, 125, 0.25)";
    const widthRatio = 2 ** (pathWidthSemitones.value / 24);
    context.lineWidth = Math.max(9, Math.abs(frequencyY(500 / widthRatio, height) - frequencyY(500 * widthRatio, height)));
    context.stroke();
    context.strokeStyle = "#ffcd7d";
    context.lineWidth = 2;
    context.stroke();
  }
}
function scheduleDraw() {
  if (drawFrame !== null) return;
  drawFrame = requestAnimationFrame(() => {
    drawFrame = null;
    draw(sourceCanvas.value, props.spectrogram, false);
    draw(resultCanvas.value, previewSpectrogram.value, true);
  });
}
function pointerDown(event: PointerEvent) {
  if (!props.buffer || props.disabled) return;
  const canvas = sourceCanvas.value;
  if (!canvas) return;
  pointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  const point = eventPoint(event, canvas);
  if (mode.value === "region") {
    const rect = canvas.getBoundingClientRect();
    const toleranceTime = 9 / rect.width * (props.buffer?.duration ?? 1);
    const toleranceLog = 9 / rect.height * Math.log2(viewRange.value.max / viewRange.value.min);
    for (let index = regions.value.length - 1; index >= 0; index -= 1) {
      const region = regions.value[index];
      const insideTime = point.time >= region.startTime - toleranceTime && point.time <= region.endTime + toleranceTime;
      const pointLog = Math.log2(point.frequency);
      const insideFrequency = pointLog >= Math.log2(region.lowFrequency) - toleranceLog && pointLog <= Math.log2(region.highFrequency) + toleranceLog;
      if (!insideTime || !insideFrequency) continue;
      const handle = Math.abs(point.time - region.startTime) < toleranceTime ? "start"
        : Math.abs(point.time - region.endTime) < toleranceTime ? "end"
        : Math.abs(pointLog - Math.log2(region.lowFrequency)) < toleranceLog ? "low"
        : Math.abs(pointLog - Math.log2(region.highFrequency)) < toleranceLog ? "high" : "move";
      regionDrag = { index, handle, point, original: { ...region } };
      break;
    }
    if (!regionDrag) draftRegion.value = { startTime: point.time, endTime: point.time, lowFrequency: point.frequency, highFrequency: point.frequency };
  }
  else draftPath.value = { points: [point] };
  scheduleDraw();
}
function pointerMove(event: PointerEvent) {
  if (pointerId !== event.pointerId || !sourceCanvas.value) return;
  const point = eventPoint(event, sourceCanvas.value);
  if (regionDrag) {
    const { index, handle, original } = regionDrag;
    const next = { ...original };
    if (handle === "start") next.startTime = clamp(point.time, 0, next.endTime - 0.01);
    if (handle === "end") next.endTime = clamp(point.time, next.startTime + 0.01, props.buffer?.duration ?? 0);
    if (handle === "low") next.lowFrequency = clamp(point.frequency, minFrequency, next.highFrequency / 1.01);
    if (handle === "high") next.highFrequency = clamp(point.frequency, next.lowFrequency * 1.01, maxFrequency.value);
    if (handle === "move") {
      const deltaTime = clamp(point.time - regionDrag.point.time, -original.startTime, (props.buffer?.duration ?? 0) - original.endTime);
      const ratio = clamp(point.frequency / regionDrag.point.frequency, minFrequency / original.lowFrequency, maxFrequency.value / original.highFrequency);
      next.startTime += deltaTime;
      next.endTime += deltaTime;
      next.lowFrequency *= ratio;
      next.highFrequency *= ratio;
    }
    regions.value[index] = next;
  } else if (draftRegion.value) {
    const initial = draftRegion.value;
    draftRegion.value = { ...initial, endTime: point.time, highFrequency: point.frequency };
  } else if (draftPath.value) {
    const points = draftPath.value.points;
    const last = points[points.length - 1];
    if (Math.abs(last.time - point.time) >= Math.max(0.004, (props.buffer?.duration ?? 1) / 500)) draftPath.value = { points: [...points, point] };
  }
  scheduleDraw();
}
function pointerUp(event: PointerEvent) {
  if (pointerId !== event.pointerId) return;
  pointerMove(event);
  if (draftRegion.value) {
    const region = draftRegion.value;
    const startTime = Math.min(region.startTime, region.endTime);
    const endTime = Math.max(region.startTime, region.endTime);
    const lowFrequency = Math.min(region.lowFrequency, region.highFrequency);
    const highFrequency = Math.max(region.lowFrequency, region.highFrequency);
    if (endTime - startTime > 0.02 && highFrequency / lowFrequency > 1.02) {
      regions.value.push({ startTime, endTime, lowFrequency, highFrequency });
      selectionOrder.value.push("region");
    }
  }
  if (draftPath.value?.points.length && draftPath.value.points.length > 1) {
    const points = draftPath.value.points;
    const ordered = points[0].time > points[points.length - 1].time ? [...points].reverse() : points;
    const cleaned: SpectralPoint[] = [];
    for (const point of ordered) {
      if (!cleaned.length || point.time > cleaned[cleaned.length - 1].time) cleaned.push(point);
    }
    if (cleaned.length > 1) {
      paths.value.push({ points: cleaned });
      selectionOrder.value.push("path");
    }
  }
  draftRegion.value = null;
  draftPath.value = null;
  regionDrag = null;
  pointerId = null;
  if (sourceCanvas.value?.hasPointerCapture(event.pointerId)) sourceCanvas.value.releasePointerCapture(event.pointerId);
  scheduleDraw();
  invalidatePreview();
}
function pause() { sourceAudio.value?.pause(); resultAudio.value?.pause(); isPlaying.value = false; }
function invalidatePreview() {
  renderVersion += 1;
  if (renderTimer !== null) clearTimeout(renderTimer);
  pause();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = "";
  previewBytes.value = null;
  previewBuffer.value = null;
  if (listenTo.value === "result") listenTo.value = "current";
  scheduleDraw();
  if (regions.value.length || paths.value.length) renderTimer = window.setTimeout(() => void renderPreview(), 100);
}
async function renderPreview() {
  if (!props.buffer || (!regions.value.length && !paths.value.length)) return;
  const version = ++renderVersion;
  isRendering.value = true;
  error.value = "";
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  if (version !== renderVersion) { isRendering.value = false; return; }
  try {
    const rendered = renderSpectralEdit(props.buffer, { regions: regions.value, paths: paths.value, reductionDb: reductionDb.value, pathWidthSemitones: pathWidthSemitones.value });
    if (version !== renderVersion) return;
    const bytes = encodeWav(rendered);
    previewBytes.value = bytes;
    previewBuffer.value = rendered;
    previewUrl.value = createAudioObjectUrl(bytes);
    scheduleDraw();
  } catch (cause) {
    console.error("Spectral preview failed", cause);
    error.value = t("spectralPreviewFailed");
  } finally { isRendering.value = false; }
}
function undoSelection() {
  const last = selectionOrder.value.pop();
  if (last === "path") paths.value.pop();
  if (last === "region") regions.value.pop();
  invalidatePreview();
}
function clearSelections() { regions.value = []; paths.value = []; selectionOrder.value = []; invalidatePreview(); }
async function togglePlay() {
  const audio = listenTo.value === "result" ? resultAudio.value : sourceAudio.value;
  if (!audio) return;
  if (!audio.paused) { pause(); return; }
  pause();
  try { await audio.play(); isPlaying.value = true; } catch { error.value = t("playbackFailed"); }
}
function selectListen(target: "current" | "result") { pause(); listenTo.value = target; }
function apply() { if (previewBytes.value) emit("apply", previewBytes.value); }
defineExpose({ togglePlay });
watch([reductionDb, pathWidthSemitones], invalidatePreview);
watch(() => props.buffer, () => { clearSelections(); nextTick(scheduleDraw); });
let resizeObserver: ResizeObserver | null = null;
onMounted(() => { resizeObserver = new ResizeObserver(scheduleDraw); if (sourceCanvas.value) resizeObserver.observe(sourceCanvas.value); if (resultCanvas.value) resizeObserver.observe(resultCanvas.value); nextTick(scheduleDraw); });
onBeforeUnmount(() => { renderVersion += 1; pause(); resizeObserver?.disconnect(); if (renderTimer !== null) clearTimeout(renderTimer); if (drawFrame !== null) cancelAnimationFrame(drawFrame); if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); });
</script>

<template>
  <section class="spectral-editor">
    <header class="spectral-top">
      <div><h2>{{ t('spectralEditor') }}</h2><p>{{ t('selectionCount', { regions: regions.length, paths: paths.length }) }}</p></div>
      <div class="spectral-actions">
        <div class="spectral-switch"><button :class="{ active: mode === 'region' }" @click="mode = 'region'">{{ t('region') }}</button><button :class="{ active: mode === 'path' }" @click="mode = 'path'">{{ t('drawPath') }}</button></div>
        <div class="spectral-switch"><button :class="{ active: listenTo === 'current' }" @click="selectListen('current')">{{ t('current') }}</button><button :class="{ active: listenTo === 'result' }" :disabled="!previewUrl" @click="selectListen('result')">{{ t('result') }}</button></div>
        <button @click="togglePlay" :disabled="disabled || (listenTo === 'result' && !previewUrl)">{{ isPlaying ? t('pause') : t('play') }}</button>
      </div>
    </header>
    <div class="spectral-ruler"><span>0.000 s</span><span>{{ ((buffer?.duration ?? 0) / 2).toFixed(3) }} s</span><span>{{ (buffer?.duration ?? 0).toFixed(3) }} s</span></div>
    <div class="spectral-views">
      <section><header><strong>{{ t('currentAudio') }}</strong><span>{{ mode === 'region' ? t('regionHint') : t('pathHint') }}</span></header><canvas ref="sourceCanvas" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" /></section>
      <section><header><strong>{{ t('resultPreview') }}</strong><span>{{ isRendering ? t('processing') : previewUrl ? t('readyToCompare') : t('makeSelection') }}</span></header><canvas ref="resultCanvas" /></section>
    </div>
    <div class="spectral-controls">
      <label><span>{{ t('reduction') }} <strong>{{ reductionDb }} dB</strong></span><input v-model.number="reductionDb" type="range" min="0" max="60" step="1" :style="{ '--range-fill': `${reductionDb / 60 * 100}%` }" /></label>
      <label><span>{{ t('pathWidth') }} <strong>{{ t('semitonesValue', { value: pathWidthSemitones }) }}</strong></span><input v-model.number="pathWidthSemitones" type="range" min="0.5" max="24" step="0.5" :style="{ '--range-fill': `${(pathWidthSemitones - 0.5) / 23.5 * 100}%` }" /></label>
      <button :disabled="!regions.length && !paths.length" @click="undoSelection">{{ t('removeLast') }}</button>
      <button :disabled="!regions.length && !paths.length" @click="clearSelections">{{ t('clear') }}</button>
      <button class="primary" :disabled="disabled || isRendering || !previewBytes" @click="apply">{{ t('applyResult') }}</button>
    </div>
    <p v-if="error" class="spectral-error">{{ error }}</p>
    <audio ref="sourceAudio" :src="sourceUrl" @ended="isPlaying = false" />
    <audio ref="resultAudio" :src="previewUrl" @ended="isPlaying = false" />
  </section>
</template>

<style scoped>
.spectral-editor { display:grid; grid-template-rows:auto 22px minmax(300px,1fr) auto; min-height:0; margin:20px; overflow:hidden; color:#f5f8fb; background:#2f3d4a; border:1px solid rgba(178,213,230,.12); border-radius:8px; }
.spectral-top { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; padding:14px 18px; }
.spectral-top h2,.spectral-top p { margin:0; } .spectral-top h2 { font-size:17px; } .spectral-top p { color:#afc1cd; font-size:13px; }
.spectral-actions,.spectral-switch,.spectral-controls { display:flex; align-items:center; gap:8px; }
.spectral-actions { flex-wrap:wrap; }
button { height:34px; padding:0 12px; color:#f5f8fb; border:0; border-radius:5px; background:#172129; cursor:pointer; } button.active,.primary { background:#3d6074; } button:disabled { opacity:.45; cursor:default; }
.spectral-switch { gap:2px; padding:3px; border-radius:6px; background:#172129; } .spectral-switch button { background:transparent; } .spectral-switch button.active { background:#3d6074; }
.spectral-ruler { display:flex; justify-content:space-between; padding:0 16px; color:#afc1cd; font-size:12px; }
.spectral-views { display:grid; grid-template-rows:repeat(2,minmax(0,1fr)); gap:8px; min-height:0; padding:0 10px 10px; }
.spectral-views section { display:grid; grid-template-rows:25px minmax(0,1fr); min-height:0; overflow:hidden; border:1px solid rgba(178,213,230,.14); border-radius:5px; }
.spectral-views header { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:0 10px; font-size:12px; color:#c5d4dd; }
.spectral-views header span { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
canvas { display:block; width:100%; height:100%; min-height:0; background:#18242f; touch-action:none; } .spectral-views section:first-child canvas { cursor:crosshair; }
.spectral-controls { flex-wrap:wrap; gap:10px; padding:12px 14px; border-top:1px solid rgba(178,213,230,.1); }
.spectral-controls label { display:grid; gap:9px; min-width:145px; flex:1; font-size:12px; color:#afc1cd; }
.spectral-controls label strong { color:#f5f8fb; font-weight:600; }
.spectral-controls input[type="range"] { appearance:none; -webkit-appearance:none; width:100%; height:7px; margin:4px 0; border:1px solid rgba(178,213,230,.14); border-radius:99px; outline:none; background:linear-gradient(to right,#6a9bb5 0 var(--range-fill),#192832 var(--range-fill) 100%); cursor:pointer; }
.spectral-controls input[type="range"]::-webkit-slider-thumb { appearance:none; -webkit-appearance:none; width:16px; height:16px; border:2px solid #2f3d4a; border-radius:50%; background:#c5e1ef; box-shadow:0 0 0 1px #6a9bb5; }
.spectral-controls input[type="range"]::-moz-range-track { height:7px; border:0; background:transparent; }
.spectral-controls input[type="range"]::-moz-range-thumb { width:12px; height:12px; border:2px solid #2f3d4a; border-radius:50%; background:#c5e1ef; box-shadow:0 0 0 1px #6a9bb5; }
.spectral-controls input[type="range"]:hover::-webkit-slider-thumb { background:#f5f8fb; }
.spectral-controls input[type="range"]:hover::-moz-range-thumb { background:#f5f8fb; }
.spectral-controls input[type="range"]:focus-visible { outline:2px solid #c5e1ef; outline-offset:5px; }
.spectral-error { margin:0 10px 8px; color:#ff9c9c; } audio { display:none; }
</style>
