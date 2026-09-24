<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  createAudioObjectUrl,
  decodeAudioBytesWithNativeFallback,
  encodeWav,
  flattenPitchAudio,
  pitchCurveSemitonesAt,
  renderLoopAudio,
  type LoopRenderMode,
} from "@/services/audioProcessing";
import { computeSpectrogram, spectrogramColor, type SpectrogramData } from "@/services/spectrogram";
import SpectralEditorPanel from "./SpectralEditorPanel.vue";
import { useAssetPayloadStore } from "@/stores/assetPayloads";
import { useI18nStore } from "@/stores/i18n";
import { useProjectStore } from "@/stores/project";

const props = defineProps<{
  trackId: string;
  assetId: string;
}>();

const emit = defineEmits<{
  "return-editor": [];
  saved: [];
}>();

type AudioTool = "loop" | "flatten" | "spectral";
type DragTarget = "start" | "end" | "selection" | "new-selection" | null;
type ListenMode = "source" | "working" | "loop";

interface AudioEditSnapshot {
  label: string;
  bytes: Uint8Array;
}

interface PitchReferencePoint {
  time: number;
  frequency: number;
}

const projectStore = useProjectStore();
const assetPayloadStore = useAssetPayloadStore();
const i18n = useI18nStore();
function t(key: string, values: Record<string, string | number> = {}) {
  return i18n.t(`audio.${key}`).replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}

const activeTool = ref<AudioTool>("loop");
const workingBytes = ref<Uint8Array | null>(null);
const workingBuffer = ref<AudioBuffer | null>(null);
const workingUrl = ref("");
const sourceUrl = ref("");
const isProcessing = ref(false);
const isCanvasReady = ref(false);
const localError = ref("");
const undoStack = ref<AudioEditSnapshot[]>([]);
const redoStack = ref<AudioEditSnapshot[]>([]);

const waveformCanvas = ref<HTMLCanvasElement | null>(null);
const spectralEditor = ref<InstanceType<typeof SpectralEditorPanel> | null>(null);
const overviewCanvas = ref<HTMLCanvasElement | null>(null);
const flattenPreviewCanvas = ref<HTMLCanvasElement | null>(null);
const startDetailCanvas = ref<HTMLCanvasElement | null>(null);
const endDetailCanvas = ref<HTMLCanvasElement | null>(null);
const seamDetailCanvas = ref<HTMLCanvasElement | null>(null);
const waveformFrame = ref<HTMLDivElement | null>(null);
const workingAudio = ref<HTMLAudioElement | null>(null);
const sourceAudio = ref<HTMLAudioElement | null>(null);
const flattenPreviewAudio = ref<HTMLAudioElement | null>(null);
const playheadSec = ref(0);
const dragTarget = ref<DragTarget>(null);
const dragStartSec = ref(0);
const dragInitialStart = ref(0);
const dragInitialEnd = ref(0);
const detailDragPoint = ref<"start" | "end" | null>(null);
const detailDragX = ref(0);
const detailDragTime = ref(0);
const zoomLevel = ref(1);
const viewStartSec = ref(0);
const listenMode = ref<ListenMode>("working");
const isPlaying = ref(false);
const showDiscardConfirm = ref(false);
const savedSnapshot = ref<AudioEditSnapshot | null>(null);
const loadedAssetId = ref<string | null>(null);

const loopStart = ref(0);
const loopEnd = ref(1);
const loopMode = ref<LoopRenderMode>("normal");
const loopFadeMs = ref(8);
const nudgeStep = ref<"sample" | "ms1" | "ms10">("ms10");
const flattenSemitones = ref(0);
const pitchReferencePoints = ref<PitchReferencePoint[]>([]);
const pitchCurveMode = ref<"line" | "bezier">("line");
const pitchControlPoints = ref<[PitchReferencePoint, PitchReferencePoint] | null>(null);
const flattenPreviewUrl = ref("");
const flattenPreviewBytes = ref<Uint8Array | null>(null);
const workingSpectrogram = ref<SpectrogramData | null>(null);
const flattenPreviewSpectrogram = ref<SpectrogramData | null>(null);
const pitchListenMode = ref<"working" | "preview">("working");
const pitchDragIndex = ref<number | null>(null);
const pitchControlDragIndex = ref<number | null>(null);

let resizeObserver: ResizeObserver | null = null;
let renderFrame: number | null = null;
let pitchPreviewTimer: number | null = null;
let loopPreviewTimer: number | null = null;
let pitchPreviewGeneration = 0;
let loopAudioContext: AudioContext | null = null;
let loopPlaybackSource: AudioBufferSourceNode | null = null;
let loopPlaybackGain: GainNode | null = null;
let loopPlaybackBuffer: AudioBuffer | null = null;

const asset = computed(() => projectStore.assetById.get(props.assetId) ?? null);
const track = computed(() => projectStore.trackById.get(props.trackId) ?? null);
const sourceBytes = computed(() => assetPayloadStore.getPayload(props.assetId));
const canUndo = computed(() => undoStack.value.length > 1);
const canRedo = computed(() => redoStack.value.length > 0);
const isDirty = computed(() => undoStack.value.length > 0 && undoStack.value[undoStack.value.length - 1] !== savedSnapshot.value);
const durationSec = computed(() => workingBuffer.value?.duration ?? 0);
const viewDurationSec = computed(() => durationSec.value / zoomLevel.value);
const viewEndSec = computed(() => viewStartSec.value + viewDurationSec.value);
const durationLabel = computed(() =>
  durationSec.value > 0 ? `${durationSec.value.toFixed(2)} s` : "-",
);
const selectionDuration = computed(() =>
  Math.max(0, loopEnd.value - loopStart.value),
);
const renderedDuration = computed(() => {
  const sampleRate = workingBuffer.value?.sampleRate ?? 0;
  if (!sampleRate) return 0;
  const selectedFrames = Math.max(1, Math.floor(loopEnd.value * sampleRate) - Math.floor(loopStart.value * sampleRate));
  const outputFrames = loopMode.value === "pingpong"
    ? Math.max(1, selectedFrames * 2 - 2)
    : selectedFrames - Math.min(Math.max(0, Math.floor((loopFadeMs.value / 1000) * sampleRate) || 0), Math.floor(selectedFrames / 4));
  return outputFrames / sampleRate;
});
const loopStartSample = computed(() =>
  Math.round(loopStart.value * (workingBuffer.value?.sampleRate ?? 0)),
);
const loopEndSample = computed(() =>
  Math.round(loopEnd.value * (workingBuffer.value?.sampleRate ?? 0)),
);
const nudgeSamples = computed(() => {
  const sampleRate = workingBuffer.value?.sampleRate ?? 0;
  return nudgeStep.value === "sample" ? 1 : Math.max(1, Math.round(sampleRate * (nudgeStep.value === "ms1" ? 0.001 : 0.01)));
});
const nudgeLabel = computed(() => nudgeStep.value === "sample" ? t("oneSample") : nudgeStep.value === "ms1" ? t("oneMs") : t("tenMs"));
const flattenOctaves = computed(() => flattenSemitones.value / 12);
const canPreviewFlatten = computed(() => Boolean(workingBuffer.value && pitchReferencePoints.value.length === 2));
const pitchSelectionWarning = computed(() => {
  const points = pitchReferencePoints.value;
  const spectrogram = workingSpectrogram.value;
  if (points.length !== 2 || !spectrogram) return "";
  if (Math.abs(flattenSemitones.value) > 36) {
    return t("widePitchWarning", { octaves: Math.abs(flattenOctaves.value).toFixed(1) });
  }
  for (let pointIndex = 0; pointIndex < 2; pointIndex += 1) {
    const point = points[pointIndex];
    const columnIndex = Math.round((point.time / Math.max(durationSec.value, 0.001)) * (spectrogram.columns.length - 1));
    const column = spectrogram.columns[clamp(columnIndex, 0, spectrogram.columns.length - 1)];
    if (!column) continue;
    const binIndex = spectrogram.frequencies.reduce((best, frequency, index) =>
      Math.abs(Math.log2(frequency / point.frequency)) < Math.abs(Math.log2(spectrogram.frequencies[best] / point.frequency)) ? index : best,
    0);
    const nearbyDb = Math.max(...column.magnitudes.slice(Math.max(0, binIndex - 1), binIndex + 2));
    if (nearbyDb < Math.max(...column.magnitudes) - 28) {
      return t("weakPitchWarning", { point: pointIndex === 0 ? t("start") : t("end") });
    }
  }
  return "";
});
const expectedFlatFrequency = computed(() => {
  const [start] = pitchReferencePoints.value;
  const reference = pitchFlattenReference();
  if (!start || !reference || !durationSec.value) return null;
  let frequencySum = 0;
  const samples = 256;
  for (let index = 0; index < samples; index += 1) {
    const time = (index + 0.5) * durationSec.value / samples;
    const progress = clamp((time - reference.startSec) / Math.max(reference.endSec - reference.startSec, 0.001), 0, 1);
    frequencySum += start.frequency * 2 ** (pitchCurveSemitonesAt(progress, flattenSemitones.value, reference.curve) / 12);
  }
  return frequencySum / samples;
});
const pitchDisplayRange = computed(() => {
  return { min: PITCH_MIN_FREQUENCY, max: Math.min(PITCH_MAX_FREQUENCY, (workingBuffer.value?.sampleRate ?? 44100) / 2) };
});
const pitchStepLabel = computed(() => {
  if (pitchReferencePoints.value.length === 0) return t("pickStartPitch");
  if (pitchReferencePoints.value.length === 1) return t("pickEndPitch");
  return pitchCurveMode.value === "line"
    ? t("straightPathHint")
    : t("bezierPathHint");
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(value: number) {
  return `${value.toFixed(3)} s`;
}

function audioTypeForBytes(bytes: Uint8Array) {
  const header = String.fromCharCode(...bytes.slice(0, 4));
  return header === "OggS" ? "audio/ogg" : "audio/wav";
}

function revokePreviewUrls() {
  if (flattenPreviewUrl.value) URL.revokeObjectURL(flattenPreviewUrl.value);
  flattenPreviewUrl.value = "";
  flattenPreviewBytes.value = null;
  flattenPreviewSpectrogram.value = null;
  pitchListenMode.value = "working";
}

async function setWorkingBytes(
  bytes: Uint8Array,
  label: string,
  pushHistory = true,
) {
  pauseWorking();
  loopPlaybackBuffer = null;
  if (workingUrl.value) URL.revokeObjectURL(workingUrl.value);

  const nextBytes = new Uint8Array(bytes);
  const decoded = await decodeAudioBytesWithNativeFallback(nextBytes, {
    path: asset.value?.originalPath,
    fileName: asset.value?.fileName,
  });
  const playableBytes = new Uint8Array(decoded.bytes);
  workingBytes.value = playableBytes;
  workingUrl.value = createAudioObjectUrl(
    playableBytes,
    audioTypeForBytes(playableBytes),
  );
  workingBuffer.value = decoded.buffer;
  workingSpectrogram.value = computeSpectrogram(workingBuffer.value, pitchDisplayRange.value.max, 256, PITCH_MIN_FREQUENCY);
  playheadSec.value = 0;
  zoomLevel.value = 1;
  viewStartSec.value = 0;
  revokePreviewUrls();

  if (pushHistory) {
    undoStack.value.push({ label, bytes: new Uint8Array(playableBytes) });
    redoStack.value = [];
  }

  await nextTick();
  scheduleWaveformRender();
}

async function restoreSnapshot(snapshot: AudioEditSnapshot) {
  isProcessing.value = true;
  try {
    await setWorkingBytes(snapshot.bytes, snapshot.label, false);
  } finally {
    isProcessing.value = false;
  }
}

function applyUndo() {
  if (!canUndo.value || isProcessing.value) return;

  const current = undoStack.value.pop();
  if (current) redoStack.value.push(current);

  const previous = undoStack.value[undoStack.value.length - 1];
  if (previous) restoreSnapshot(previous);
}

function applyRedo() {
  if (isProcessing.value) return;
  const next = redoStack.value.pop();
  if (!next) return;

  undoStack.value.push(next);
  restoreSnapshot(next);
}

function normalizeLoopSelection() {
  const duration = Math.max(durationSec.value, 0.001);
  const start = clamp(Math.min(loopStart.value, loopEnd.value), 0, duration);
  const end = clamp(Math.max(loopStart.value, loopEnd.value), 0.001, duration);
  loopStart.value = Math.min(start, end - 0.001);
  loopEnd.value = Math.max(end, loopStart.value + 0.001);
}

function timeToX(time: number, width: number, overview = false) {
  const duration = Math.max(durationSec.value, 0.001);
  if (overview || activeTool.value === "flatten") {
    return (clamp(time, 0, duration) / duration) * width;
  }
  return ((time - viewStartSec.value) / Math.max(viewDurationSec.value, 0.001)) * width;
}

function xToTime(x: number, width: number, overview = false) {
  const duration = Math.max(durationSec.value, 0.001);
  if (overview || activeTool.value === "flatten") {
    return clamp((x / Math.max(width, 1)) * duration, 0, duration);
  }
  return clamp(viewStartSec.value + (x / Math.max(width, 1)) * viewDurationSec.value, 0, duration);
}

function setZoom(nextZoom: number, anchorSec = (viewStartSec.value + viewEndSec.value) / 2) {
  const previousDuration = viewDurationSec.value;
  const anchorRatio = previousDuration > 0
    ? clamp((anchorSec - viewStartSec.value) / previousDuration, 0, 1)
    : 0.5;
  zoomLevel.value = clamp(nextZoom, 1, 64);
  viewStartSec.value = clamp(
    anchorSec - anchorRatio * viewDurationSec.value,
    0,
    Math.max(0, durationSec.value - viewDurationSec.value),
  );
  scheduleWaveformRender();
}

function handleWaveformWheel(event: WheelEvent) {
  if (activeTool.value !== "loop") return;
  event.preventDefault();
  const canvas = waveformCanvas.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const anchorSec = xToTime(event.clientX - rect.left, rect.width);
  setZoom(zoomLevel.value * (event.deltaY < 0 ? 1.4 : 1 / 1.4), anchorSec);
}

function handleOverviewPointerDown(event: PointerEvent) {
  if (activeTool.value !== "loop" || zoomLevel.value === 1) return;
  const canvas = overviewCanvas.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const center = xToTime(event.clientX - rect.left, rect.width, true);
  viewStartSec.value = clamp(
    center - viewDurationSec.value / 2,
    0,
    Math.max(0, durationSec.value - viewDurationSec.value),
  );
  scheduleWaveformRender();
}

const PITCH_MIN_FREQUENCY = 20;
const PITCH_MAX_FREQUENCY = 12000;

function yToFrequency(y: number, height: number) {
  const ratio = clamp(1 - y / Math.max(height, 1), 0, 1);
  const minLog = Math.log2(pitchDisplayRange.value.min);
  const maxLog = Math.log2(pitchDisplayRange.value.max);
  return 2 ** (minLog + ratio * (maxLog - minLog));
}

function frequencyToY(frequency: number, height: number) {
  const minLog = Math.log2(pitchDisplayRange.value.min);
  const maxLog = Math.log2(pitchDisplayRange.value.max);
  const ratio =
    (Math.log2(clamp(frequency, pitchDisplayRange.value.min, pitchDisplayRange.value.max)) -
      minLog) /
    (maxLog - minLog);
  return (1 - ratio) * height;
}

const spectrogramCanvasCache = new WeakMap<SpectrogramData, Map<string, HTMLCanvasElement>>();

function drawSpectrogram(
  outputContext: CanvasRenderingContext2D,
  width: number,
  height: number,
  spectrogram: SpectrogramData,
  preview = false,
) {
  const range = pitchDisplayRange.value;
  const cacheKey = `${width}:${height}:${range.min}:${range.max}:${preview}`;
  let cachedVariants = spectrogramCanvasCache.get(spectrogram);
  if (!cachedVariants) {
    cachedVariants = new Map();
    spectrogramCanvasCache.set(spectrogram, cachedVariants);
  }
  const cachedCanvas = cachedVariants.get(cacheKey);
  if (cachedCanvas) {
    outputContext.drawImage(cachedCanvas, 0, 0);
    return;
  }
  const imageCanvas = document.createElement("canvas");
  imageCanvas.width = width;
  imageCanvas.height = height;
  const context = imageCanvas.getContext("2d");
  if (!context) return;
  const columnWidth = width / Math.max(spectrogram.columns.length, 1);

  context.fillStyle = preview ? "#201f2b" : "#18242f";
  context.fillRect(0, 0, width, height);

  spectrogram.columns.forEach((column, columnIndex) => {
    const x = Math.floor(columnIndex * columnWidth);
    const nextX = Math.ceil((columnIndex + 1) * columnWidth);

    spectrogram.frequencies.forEach((frequency, binIndex) => {
      if (frequency < range.min || frequency > range.max) return;

      const nextFrequency =
        spectrogram.frequencies[binIndex + 1] ??
        frequency * (spectrogram.frequencies[1] / spectrogram.frequencies[0]);
      const yTop = frequencyToY(nextFrequency, height);
      const yBottom = frequencyToY(frequency, height);
      const normalized =
        ((column.magnitudes[binIndex] ?? spectrogram.minDb) - spectrogram.minDb) /
        Math.max(spectrogram.maxDb - spectrogram.minDb, 1);

      context.fillStyle = spectrogramColor(clamp(normalized, 0, 1) ** 1.6, preview);
      context.fillRect(
        x,
        Math.floor(yTop),
        Math.max(1, nextX - x),
        Math.max(1, Math.ceil(yBottom - yTop)),
      );
    });
  });

  context.strokeStyle = "rgba(214, 230, 241, 0.12)";
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += 80) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  if (cachedVariants.size >= 3) cachedVariants.delete(cachedVariants.keys().next().value!);
  cachedVariants.set(cacheKey, imageCanvas);
  outputContext.drawImage(imageCanvas, 0, 0);
}

function setupCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  dense = false,
) {
  context.fillStyle = "#344453";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(214, 230, 241, 0.18)";
  context.lineWidth = 1;

  const verticalStep = dense ? 56 : 80;
  const horizontalStep = dense ? 28 : 42;

  for (let x = 0; x <= width; x += verticalStep) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }

  for (let y = 0; y <= height; y += horizontalStep) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
}

function drawWaveform(
  canvas: HTMLCanvasElement | null,
  options: { overview?: boolean } = {},
) {
  const buffer = workingBuffer.value;
  if (!canvas || !buffer) return;

  const setup = setupCanvas(canvas);
  if (!setup) return;

  const { context, width, height } = setup;

  if (activeTool.value === "flatten" && !options.overview) {
    drawPitchSpectrogramView(context, width, height);
    return;
  }

  drawGrid(context, width, height, options.overview === true);

  const data = buffer.getChannelData(0);
  const centerY = height / 2;
  const amp = height * (options.overview ? 0.36 : 0.42);
  const visibleStart = options.overview ? 0 : Math.floor(viewStartSec.value * buffer.sampleRate);
  const visibleEnd = options.overview
    ? data.length
    : Math.min(data.length, Math.ceil(viewEndSec.value * buffer.sampleRate));
  const framesPerPixel = (visibleEnd - visibleStart) / width;

  context.strokeStyle = options.overview ? "#7898aa" : "#b8d4df";
  context.lineWidth = options.overview ? 1 : 1.4;
  context.beginPath();

  for (let x = 0; x < width; x += 1) {
    const start = Math.min(data.length - 1, Math.floor(visibleStart + x * framesPerPixel));
    const end = Math.min(Math.max(start + 1, Math.ceil(visibleStart + (x + 1) * framesPerPixel)), data.length);
    let min = 1;
    let max = -1;

    for (let index = start; index < end; index += 1) {
      const sample = data[index] ?? 0;
      min = Math.min(min, sample);
      max = Math.max(max, sample);
    }

    context.moveTo(x + 0.5, centerY + min * amp);
    context.lineTo(x + 0.5, centerY + max * amp);
  }

  context.stroke();

  const startX = timeToX(loopStart.value, width, options.overview);
  const endX = timeToX(loopEnd.value, width, options.overview);
  const playheadX = timeToX(playheadSec.value, width, options.overview);

  if (activeTool.value === "loop") {
    context.fillStyle = options.overview
      ? "rgba(255, 229, 155, 0.16)"
      : "rgba(255, 229, 155, 0.18)";
    context.fillRect(startX, 0, Math.max(1, endX - startX), height);

    if (!options.overview) {
      context.fillStyle = "rgba(255, 229, 155, 0.92)";
      context.fillRect(startX - 2, 0, 4, height);
      context.fillRect(endX - 2, 0, 4, height);
    }
  }

  if (options.overview && activeTool.value === "loop" && zoomLevel.value > 1) {
    const viewX = timeToX(viewStartSec.value, width, true);
    const viewWidth = (viewDurationSec.value / durationSec.value) * width;
    context.strokeStyle = "#d4edfa";
    context.lineWidth = 2;
    context.strokeRect(viewX + 1, 1, Math.max(1, viewWidth - 2), height - 2);
  }

  context.strokeStyle = "#ff6969";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(playheadX + 0.5, 0);
  context.lineTo(playheadX + 0.5, height);
  context.stroke();
}

function drawPitchSpectrogramView(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const spectrogram = workingSpectrogram.value;
  if (!spectrogram || spectrogram.columns.length === 0) {
    drawGrid(context, width, height);
    drawPitchReferenceOverlay(context, width, height);
    context.fillStyle = "rgba(245, 248, 251, 0.58)";
    context.font = "13px Segoe UI, sans-serif";
    context.fillText(t("noSpectrogram"), 16, height / 2);
    return;
  }

  drawSpectrogram(context, width, height, spectrogram);
  drawPitchReferenceOverlay(context, width, height);
}

function drawFlattenPreviewView(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { context, width, height } = setup;
  const spectrogram = flattenPreviewSpectrogram.value;
  if (spectrogram) {
    drawSpectrogram(context, width, height, spectrogram, true);
    const target = expectedFlatFrequency.value;
    if (target && target >= pitchDisplayRange.value.min && target <= pitchDisplayRange.value.max) {
      const y = frequencyToY(target, height);
      context.save();
      context.strokeStyle = "rgba(255, 229, 155, 0.9)";
      context.lineWidth = 1.5;
      context.setLineDash([6, 5]);
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
      context.setLineDash([]);
      context.font = "12px Segoe UI, sans-serif";
      context.fillStyle = "#ffe59b";
      context.fillText(t("targetHz", { hz: Math.round(target) }), Math.max(8, width - 125), Math.max(15, y - 7));
      context.restore();
    }
  } else {
    drawGrid(context, width, height);
    context.fillStyle = "rgba(245, 248, 251, 0.65)";
    context.font = "13px Segoe UI, sans-serif";
    context.fillText(t("chooseTwoPitches"), 16, height / 2);
  }
}

function clearPitchReferencePoints() {
  pitchReferencePoints.value = [];
  pitchControlPoints.value = null;
  flattenSemitones.value = 0;
  invalidatePitchPreview();
  scheduleWaveformRender();
}

function invalidatePitchPreview(schedule = true) {
  pitchPreviewGeneration += 1;
  if (pitchPreviewTimer !== null) {
    window.clearTimeout(pitchPreviewTimer);
    pitchPreviewTimer = null;
  }
  flattenPreviewAudio.value?.pause();
  if (pitchListenMode.value === "preview") isPlaying.value = false;
  if (flattenPreviewUrl.value) URL.revokeObjectURL(flattenPreviewUrl.value);
  flattenPreviewUrl.value = "";
  flattenPreviewBytes.value = null;
  flattenPreviewSpectrogram.value = null;
  scheduleWaveformRender();
  if (schedule && canPreviewFlatten.value && activeTool.value === "flatten") schedulePitchPreviewRefresh();
}

function initializePitchControls() {
  const [start, end] = pitchReferencePoints.value;
  if (!start || !end) return;
  const startLog = Math.log2(start.frequency);
  const logSpan = Math.log2(end.frequency) - startLog;
  pitchControlPoints.value = [1 / 3, 2 / 3].map((ratio) => ({
    time: start.time + (end.time - start.time) * ratio,
    frequency: 2 ** (startLog + logSpan * ratio),
  })) as [PitchReferencePoint, PitchReferencePoint];
}

function setPitchCurveMode(mode: "line" | "bezier") {
  if (mode === "bezier" && !pitchControlPoints.value) initializePitchControls();
  pitchCurveMode.value = mode;
  invalidatePitchPreview();
}

function updatePitchSlopeFromPoints() {
  const [start, end] = pitchReferencePoints.value;
  if (!start || !end) return;
  flattenSemitones.value = Number((12 * Math.log2(end.frequency / start.frequency)).toFixed(3));
}

function setFlattenSemitones(value: number) {
  const [start, end] = pitchReferencePoints.value;
  if (!Number.isFinite(value) || !start || !end) return;
  const frequency = clamp(start.frequency * 2 ** (clamp(value, -72, 72) / 12), pitchDisplayRange.value.min, pitchDisplayRange.value.max);
  pitchReferencePoints.value[1] = { ...end, frequency };
  updatePitchSlopeFromPoints();
  invalidatePitchPreview();
}

function drawPitchReferenceOverlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const { min, max } = pitchDisplayRange.value;
  const minLog = Math.log2(min);
  const maxLog = Math.log2(max);
  const frequencies = Array.from({ length: 6 }, (_, index) => {
    const ratio = index / 5;
    return 2 ** (minLog + ratio * (maxLog - minLog));
  });

  context.strokeStyle = "rgba(255, 229, 155, 0.14)";
  context.fillStyle = "rgba(245, 248, 251, 0.58)";
  context.font = "12px Segoe UI, sans-serif";

  frequencies.forEach((frequency) => {
    const y = frequencyToY(frequency, height);
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
    context.fillText(`${Math.round(frequency)} Hz`, 8, Math.max(14, y - 4));
  });

  const points = pitchReferencePoints.value;
  if (points.length === 2) {
    context.strokeStyle = "rgba(255, 229, 155, 0.92)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(timeToX(points[0].time, width), frequencyToY(points[0].frequency, height));
    if (pitchCurveMode.value === "bezier" && pitchControlPoints.value) {
      const [first, second] = pitchControlPoints.value;
      context.bezierCurveTo(
        timeToX(first.time, width), frequencyToY(first.frequency, height),
        timeToX(second.time, width), frequencyToY(second.frequency, height),
        timeToX(points[1].time, width), frequencyToY(points[1].frequency, height),
      );
    } else {
      context.lineTo(timeToX(points[1].time, width), frequencyToY(points[1].frequency, height));
    }
    context.stroke();

    if (pitchCurveMode.value === "bezier" && pitchControlPoints.value) {
      context.setLineDash([4, 4]);
      context.strokeStyle = "rgba(215, 233, 244, 0.55)";
      context.beginPath();
      context.moveTo(timeToX(points[0].time, width), frequencyToY(points[0].frequency, height));
      context.lineTo(timeToX(pitchControlPoints.value[0].time, width), frequencyToY(pitchControlPoints.value[0].frequency, height));
      context.moveTo(timeToX(points[1].time, width), frequencyToY(points[1].frequency, height));
      context.lineTo(timeToX(pitchControlPoints.value[1].time, width), frequencyToY(pitchControlPoints.value[1].frequency, height));
      context.stroke();
      context.setLineDash([]);
      pitchControlPoints.value.forEach((point, index) => {
        context.fillStyle = "#79d7e6";
        context.beginPath();
        context.arc(timeToX(point.time, width), frequencyToY(point.frequency, height), 6, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#f5f8fb";
        context.fillText(`C${index + 1}`, timeToX(point.time, width) + 9, frequencyToY(point.frequency, height) - 7);
      });
    }
  }

  points.forEach((point, index) => {
    const x = timeToX(point.time, width);
    const y = frequencyToY(point.frequency, height);
    context.fillStyle = index === 0 ? "#ff6969" : "#ffe59b";
    context.beginPath();
    context.arc(x, y, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f5f8fb";
    context.fillText(
      t("pointHz", { point: index === 0 ? t("start") : t("end"), hz: Math.round(point.frequency) }),
      Math.min(width - 112, x + 10),
      Math.max(16, y - 10),
    );
  });
}

function drawEndpointDetail(canvas: HTMLCanvasElement | null, centerSec: number) {
  const buffer = workingBuffer.value;
  if (!canvas || !buffer) return;

  const setup = setupCanvas(canvas);
  if (!setup) return;

  const { context, width, height } = setup;
  drawGrid(context, width, height, true);

  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const centerFrame = Math.round(centerSec * sampleRate);
  const halfWindow = Math.max(64, Math.round(sampleRate * 0.025));
  const startFrame = clamp(centerFrame - halfWindow, 0, data.length - 1);
  const endFrame = clamp(centerFrame + halfWindow, startFrame + 1, data.length);
  const frames = Math.max(1, endFrame - startFrame);
  const centerY = height / 2;
  const amp = height * 0.42;

  context.strokeStyle = "#b8d4df";
  context.lineWidth = 1.4;
  context.beginPath();

  for (let x = 0; x < width; x += 1) {
    const frame = Math.min(
      data.length - 1,
      Math.round(startFrame + (x / Math.max(width - 1, 1)) * frames),
    );
    const y = centerY - (data[frame] ?? 0) * amp;
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();

  const markerX = ((centerFrame - startFrame) / frames) * width;
  context.strokeStyle = "rgba(255, 229, 155, 0.96)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(markerX + 0.5, 0);
  context.lineTo(markerX + 0.5, height);
  context.stroke();
}

function drawSeamDetail(canvas: HTMLCanvasElement | null) {
  const buffer = workingBuffer.value;
  if (!canvas || !buffer) return;
  const setup = setupCanvas(canvas);
  if (!setup) return;
  const { context, width, height } = setup;
  drawGrid(context, width, height, true);
  const data = buffer.getChannelData(0);
  const halfFrames = Math.max(1, Math.floor(buffer.sampleRate * 0.012));
  const startFrame = Math.floor(loopStart.value * buffer.sampleRate);
  const endFrame = Math.floor(loopEnd.value * buffer.sampleRate);
  const centerY = height / 2;
  const amplitude = height * 0.42;

  function drawSide(fromFrame: number, toFrame: number, xOffset: number, color: string) {
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.beginPath();
    for (let x = 0; x <= width / 2; x += 1) {
      const ratio = x / Math.max(width / 2, 1);
      const frame = clamp(Math.round(fromFrame + (toFrame - fromFrame) * ratio), 0, data.length - 1);
      const y = centerY - (data[frame] ?? 0) * amplitude;
      if (x === 0) context.moveTo(xOffset + x, y);
      else context.lineTo(xOffset + x, y);
    }
    context.stroke();
  }

  drawSide(endFrame - halfFrames, endFrame - 1, 0, "#b8d4df");
  drawSide(startFrame, startFrame + halfFrames, width / 2, "#ffe59b");
  context.strokeStyle = "#ff6969";
  context.beginPath();
  context.moveTo(width / 2 + 0.5, 0);
  context.lineTo(width / 2 + 0.5, height);
  context.stroke();
}

function scheduleWaveformRender() {
  if (renderFrame !== null) return;

  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = null;
    drawWaveform(waveformCanvas.value);
    drawFlattenPreviewView(flattenPreviewCanvas.value);
    if (activeTool.value === "loop" || (pitchDragIndex.value === null && pitchControlDragIndex.value === null)) {
      drawWaveform(overviewCanvas.value, { overview: true });
    }
    drawEndpointDetail(startDetailCanvas.value, loopStart.value);
    drawEndpointDetail(endDetailCanvas.value, loopEnd.value);
    drawSeamDetail(seamDetailCanvas.value);
  });
}

function canvasPointerTime(event: PointerEvent) {
  const canvas = waveformCanvas.value;
  if (!canvas) return 0;
  const rect = canvas.getBoundingClientRect();
  return xToTime(event.clientX - rect.left, rect.width);
}

function chooseDragTarget(event: PointerEvent): DragTarget {
  const canvas = waveformCanvas.value;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const startX = timeToX(loopStart.value, rect.width);
  const endX = timeToX(loopEnd.value, rect.width);

  if (Math.abs(pointerX - startX) <= 10) return "start";
  if (Math.abs(pointerX - endX) <= 10) return "end";
  const coversWholeAudio = loopStart.value <= 0.001 && loopEnd.value >= durationSec.value - 0.001;
  if (!coversWholeAudio && !event.shiftKey && pointerX > startX && pointerX < endX) return "selection";
  return "new-selection";
}

function handleWaveformPointerDown(event: PointerEvent) {
  const canvas = waveformCanvas.value;
  if (!canvas) return;

  if (activeTool.value === "flatten") {
    handlePitchReferenceClick(event);
    return;
  }

  canvas.setPointerCapture(event.pointerId);
  const time = canvasPointerTime(event);
  dragTarget.value = chooseDragTarget(event);
  dragStartSec.value = time;
  dragInitialStart.value = loopStart.value;
  dragInitialEnd.value = loopEnd.value;

  if (dragTarget.value === "new-selection") {
    loopStart.value = time;
    loopEnd.value = Math.min(durationSec.value, time + 1 / (workingBuffer.value?.sampleRate ?? 44100));
    playheadSec.value = time;
    if (workingAudio.value) workingAudio.value.currentTime = time;
  }

  scheduleWaveformRender();
}

function handlePitchReferenceClick(event: PointerEvent) {
  const canvas = waveformCanvas.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const clickedTime = xToTime(event.clientX - rect.left, rect.width);
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const existingIndex = pitchReferencePoints.value.findIndex((point) =>
    Math.hypot(timeToX(point.time, rect.width) - pointerX, frequencyToY(point.frequency, rect.height) - pointerY) <= 12,
  );
  canvas.setPointerCapture(event.pointerId);
  if (existingIndex >= 0) {
    pitchDragIndex.value = existingIndex;
    return;
  }
  if (pitchCurveMode.value === "bezier" && pitchControlPoints.value) {
    const controlIndex = pitchControlPoints.value.findIndex((point) =>
      Math.hypot(timeToX(point.time, rect.width) - pointerX, frequencyToY(point.frequency, rect.height) - pointerY) <= 12,
    );
    if (controlIndex >= 0) {
      pitchControlDragIndex.value = controlIndex;
      return;
    }
  }
  const point: PitchReferencePoint = {
    time: clickedTime,
    frequency: yToFrequency(pointerY, rect.height),
  };

  const nextPoints = (
    pitchReferencePoints.value.length >= 2
      ? [point]
      : [...pitchReferencePoints.value, point]
  ).sort((a, b) => a.time - b.time);
  pitchReferencePoints.value = nextPoints;
  pitchDragIndex.value = nextPoints.findIndex((item) => item.time === point.time && item.frequency === point.frequency);
  if (nextPoints.length === 1) {
    flattenSemitones.value = 0;
    pitchControlPoints.value = null;
  } else {
    updatePitchSlopeFromPoints();
    initializePitchControls();
  }
  invalidatePitchPreview(false);
  scheduleWaveformRender();
}

function handleWaveformPointerMove(event: PointerEvent) {
  if (activeTool.value === "flatten") {
    if (!waveformCanvas.value) return;
    const rect = waveformCanvas.value.getBoundingClientRect();
    if (pitchControlDragIndex.value !== null && pitchControlPoints.value) {
      const [start, end] = pitchReferencePoints.value;
      if (!start || !end) return;
      const index = pitchControlDragIndex.value;
      const other = pitchControlPoints.value[1 - index];
      const minTime = index === 0 ? start.time : other.time;
      const maxTime = index === 0 ? other.time : end.time;
      pitchControlPoints.value[index] = {
        time: clamp(xToTime(event.clientX - rect.left, rect.width), minTime, maxTime),
        frequency: yToFrequency(event.clientY - rect.top, rect.height),
      };
      invalidatePitchPreview(false);
      return;
    }
    if (pitchDragIndex.value === null) return;
    const index = pitchDragIndex.value;
    const other = pitchReferencePoints.value[1 - index];
    const time = xToTime(event.clientX - rect.left, rect.width);
    const constrainedTime = other
      ? index === 0 ? Math.min(time, other.time - 0.001) : Math.max(time, other.time + 0.001)
      : time;
    pitchReferencePoints.value[index] = {
      time: clamp(constrainedTime, 0, durationSec.value),
      frequency: yToFrequency(event.clientY - rect.top, rect.height),
    };
    if (pitchControlPoints.value) {
      pitchControlPoints.value[0].time = clamp(
        pitchControlPoints.value[0].time,
        pitchReferencePoints.value[0].time,
        pitchReferencePoints.value[1].time,
      );
      pitchControlPoints.value[1].time = clamp(
        pitchControlPoints.value[1].time,
        pitchControlPoints.value[0].time,
        pitchReferencePoints.value[1].time,
      );
    }
    updatePitchSlopeFromPoints();
    invalidatePitchPreview(false);
    return;
  }
  const target = dragTarget.value;
  if (!target) return;

  const time = canvasPointerTime(event);
  if (target === "start") {
    loopStart.value = clamp(time, 0, loopEnd.value - 0.001);
  } else if (target === "end") {
    loopEnd.value = clamp(time, loopStart.value + 0.001, durationSec.value);
  } else if (target === "selection") {
    const delta = time - dragStartSec.value;
    const width = dragInitialEnd.value - dragInitialStart.value;
    const nextStart = clamp(dragInitialStart.value + delta, 0, durationSec.value - width);
    loopStart.value = nextStart;
    loopEnd.value = nextStart + width;
  } else if (target === "new-selection") {
    loopStart.value = Math.min(dragStartSec.value, time);
    loopEnd.value = Math.max(dragStartSec.value, time);
  }

  normalizeLoopSelection();
  scheduleWaveformRender();
}

function handleWaveformPointerUp(event: PointerEvent) {
  if (activeTool.value === "flatten") {
    const changed = pitchDragIndex.value !== null || pitchControlDragIndex.value !== null;
    pitchDragIndex.value = null;
    pitchControlDragIndex.value = null;
    if (changed) {
      scheduleWaveformRender();
      if (canPreviewFlatten.value) schedulePitchPreviewRefresh(30);
    }
  }
  if (waveformCanvas.value?.hasPointerCapture(event.pointerId)) {
    waveformCanvas.value.releasePointerCapture(event.pointerId);
  }
  dragTarget.value = null;
}

function handleDetailPointerDown(point: "start" | "end", event: PointerEvent) {
  const canvas = event.currentTarget as HTMLCanvasElement;
  canvas.setPointerCapture(event.pointerId);
  detailDragPoint.value = point;
  detailDragX.value = event.clientX;
  detailDragTime.value = point === "start" ? loopStart.value : loopEnd.value;
}

function handleDetailPointerMove(point: "start" | "end", event: PointerEvent) {
  if (detailDragPoint.value !== point) return;
  const canvas = event.currentTarget as HTMLCanvasElement;
  const deltaSec = ((event.clientX - detailDragX.value) / Math.max(canvas.clientWidth, 1)) * 0.05;
  const next = detailDragTime.value + deltaSec;
  if (point === "start") {
    loopStart.value = clamp(next, 0, loopEnd.value - 0.001);
  } else {
    loopEnd.value = clamp(next, loopStart.value + 0.001, durationSec.value);
  }
  scheduleWaveformRender();
}

function handleDetailPointerUp(event: PointerEvent) {
  const canvas = event.currentTarget as HTMLCanvasElement;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  detailDragPoint.value = null;
}

function handleWorkingTimeUpdate() {
  playheadSec.value = workingAudio.value?.currentTime ?? 0;
  scheduleWaveformRender();
}

function handleSourceTimeUpdate() {
  playheadSec.value = sourceAudio.value?.currentTime ?? 0;
  scheduleWaveformRender();
}

function handleFlattenPreviewTimeUpdate() {
  playheadSec.value = flattenPreviewAudio.value?.currentTime ?? 0;
  scheduleWaveformRender();
}

function startLoopPlayback(buffer: AudioBuffer) {
  loopAudioContext ??= new AudioContext();
  const context = loopAudioContext;
  void context.resume();
  const source = context.createBufferSource();
  const gain = context.createGain();
  const now = context.currentTime;
  const fadeSeconds = loopPlaybackSource ? 0.02 : 0;
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  gain.connect(context.destination);
  gain.gain.setValueAtTime(fadeSeconds ? 0 : 1, now);
  if (fadeSeconds) gain.gain.linearRampToValueAtTime(1, now + fadeSeconds);
  source.start(now);

  if (loopPlaybackSource && loopPlaybackGain) {
    loopPlaybackGain.gain.cancelScheduledValues(now);
    loopPlaybackGain.gain.setValueAtTime(loopPlaybackGain.gain.value, now);
    loopPlaybackGain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    loopPlaybackSource.stop(now + fadeSeconds);
  }
  loopPlaybackSource = source;
  loopPlaybackGain = gain;
  loopPlaybackBuffer = buffer;
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
  isPlaying.value = true;
}

function stopLoopPlayback() {
  if (loopPlaybackSource) {
    loopPlaybackSource.onended = null;
    loopPlaybackSource.stop();
    loopPlaybackSource.disconnect();
    loopPlaybackGain?.disconnect();
  }
  loopPlaybackSource = null;
  loopPlaybackGain = null;
}

function pauseWorking() {
  stopLoopPlayback();
  sourceAudio.value?.pause();
  workingAudio.value?.pause();
  flattenPreviewAudio.value?.pause();
  isPlaying.value = false;
}

function selectListenMode(mode: ListenMode) {
  pauseWorking();
  listenMode.value = mode;
  if (mode === "loop") {
    previewLoop();
    return;
  }
  const audio = mode === "source" ? sourceAudio.value : workingAudio.value;
  if (audio) {
    audio.currentTime = 0;
    void audio.play();
    isPlaying.value = true;
  }
}

function togglePlayback() {
  if (isPlaying.value) {
    pauseWorking();
    return;
  }
  if (listenMode.value === "loop") {
    if (loopPlaybackBuffer) startLoopPlayback(loopPlaybackBuffer);
    else previewLoop();
    return;
  }
  const audio = listenMode.value === "source" ? sourceAudio.value : workingAudio.value;
  if (!audio) return;
  void audio.play();
  isPlaying.value = true;
}

function selectPitchListenMode(mode: "working" | "preview") {
  const position = playheadSec.value;
  pauseWorking();
  pitchListenMode.value = mode;
  if (mode === "preview" && !flattenPreviewUrl.value) {
    if (canPreviewFlatten.value) void refreshPitchFlattenPreview(true);
    return;
  }
  const audio = mode === "working" ? workingAudio.value : flattenPreviewAudio.value;
  if (!audio) return;
  audio.currentTime = clamp(position, 0, audio.duration || durationSec.value);
  void audio.play();
  isPlaying.value = true;
}

function togglePitchPlayback() {
  if (isPlaying.value) pauseWorking();
  else selectPitchListenMode(pitchListenMode.value);
}

function requestReturnEditor() {
  if (isDirty.value) showDiscardConfirm.value = true;
  else emit("return-editor");
}

function nudgeLoopPoint(point: "start" | "end", direction: -1 | 1) {
  const sampleRate = workingBuffer.value?.sampleRate;
  if (!sampleRate) return;
  const gap = Math.max(1, Math.ceil(sampleRate * 0.001));
  const delta = direction * nudgeSamples.value;
  if (point === "start") {
    loopStart.value = clamp(loopStartSample.value + delta, 0, loopEndSample.value - gap) / sampleRate;
  } else {
    loopEnd.value = clamp(loopEndSample.value + delta, loopStartSample.value + gap, workingBuffer.value?.length ?? 0) / sampleRate;
  }
  scheduleWaveformRender();
}

function pitchFlattenReference() {
  const [start, end] = pitchReferencePoints.value;
  if (!start || !end) return undefined;
  const span = Math.max(end.time - start.time, 0.001);
  const [first, second] = pitchControlPoints.value ?? [];
  return {
    startSec: start.time,
    endSec: end.time,
    curve: pitchCurveMode.value === "bezier" && first && second
      ? {
          mode: "bezier" as const,
          control1: {
            timeRatio: clamp((first.time - start.time) / span, 0, 1),
            semitones: 12 * Math.log2(first.frequency / start.frequency),
          },
          control2: {
            timeRatio: clamp((second.time - start.time) / span, 0, 1),
            semitones: 12 * Math.log2(second.frequency / start.frequency),
          },
        }
      : { mode: "line" as const },
  };
}

function previewLoop() {
  const buffer = workingBuffer.value;
  if (!buffer) return;

  isProcessing.value = true;
  localError.value = "";
  try {
    normalizeLoopSelection();
    const rendered = renderLoopAudio(
      buffer,
      loopStart.value,
      loopEnd.value,
      loopMode.value,
      loopFadeMs.value,
    );
    if (listenMode.value === "loop") startLoopPlayback(rendered);
  } catch (error) {
    console.error("Loop preview failed", error);
    localError.value = t("loopPreviewFailed");
  } finally {
    isProcessing.value = false;
  }
}

async function applyLoopRender() {
  const bytes = workingBytes.value;
  if (!bytes) return;

  isProcessing.value = true;
  localError.value = "";
  try {
    const buffer = (
      await decodeAudioBytesWithNativeFallback(bytes, {
        path: asset.value?.originalPath,
        fileName: asset.value?.fileName,
      })
    ).buffer;
    normalizeLoopSelection();
    const rendered = renderLoopAudio(
      buffer,
      loopStart.value,
      loopEnd.value,
      loopMode.value,
      loopFadeMs.value,
    );
    await setWorkingBytes(encodeWav(rendered), t("applyLoopHistory"));
    loopStart.value = 0;
    loopEnd.value = Math.max(0.001, durationSec.value);
  } catch (error) {
    console.error("Loop render failed", error);
    localError.value = t("loopRenderFailed");
  } finally {
    isProcessing.value = false;
  }
}

async function applyPitchFlatten() {
  const bytes = flattenPreviewBytes.value;
  if (!bytes) return;

  isProcessing.value = true;
  localError.value = "";
  try {
    await setWorkingBytes(bytes, t("applyPitchHistory"));
    loopStart.value = 0;
    loopEnd.value = Math.max(0.001, durationSec.value);
    clearPitchReferencePoints();
    flattenSemitones.value = 0;
    pitchListenMode.value = "working";
  } catch (error) {
    console.error("Pitch flatten failed", error);
    localError.value = t("pitchFailed");
  } finally {
    isProcessing.value = false;
  }
}

async function applySpectralResult(bytes: Uint8Array) {
  isProcessing.value = true;
  localError.value = "";
  try {
    await setWorkingBytes(bytes, t("applySpectralHistory"));
  } catch (error) {
    console.error("Spectral edit failed", error);
    localError.value = t("spectralFailed");
  } finally {
    isProcessing.value = false;
  }
}

async function previewPitchFlatten() {
  await refreshPitchFlattenPreview(pitchListenMode.value === "preview" && isPlaying.value);
}

async function refreshPitchFlattenPreview(playAfterRender = false) {
  const buffer = workingBuffer.value;
  if (!buffer || !canPreviewFlatten.value) return;

  const generation = ++pitchPreviewGeneration;
  isProcessing.value = true;
  localError.value = "";
  try {
    const rendered = flattenPitchAudio(
      buffer,
      flattenSemitones.value,
      pitchFlattenReference(),
    );
    if (generation !== pitchPreviewGeneration) return;
    const previewBytes = encodeWav(rendered);
    flattenPreviewBytes.value = previewBytes;
    flattenPreviewSpectrogram.value = computeSpectrogram(rendered, pitchDisplayRange.value.max, 256, PITCH_MIN_FREQUENCY);
    flattenPreviewAudio.value?.pause();
    if (pitchListenMode.value === "preview") isPlaying.value = false;
    if (flattenPreviewUrl.value) URL.revokeObjectURL(flattenPreviewUrl.value);
    flattenPreviewUrl.value = createAudioObjectUrl(previewBytes);
    scheduleWaveformRender();
    await nextTick();
    if (playAfterRender && generation === pitchPreviewGeneration && pitchListenMode.value === "preview" && flattenPreviewAudio.value) {
      flattenPreviewAudio.value.currentTime = clamp(playheadSec.value, 0, rendered.duration);
      void flattenPreviewAudio.value.play();
      isPlaying.value = true;
    }
  } catch (error) {
    console.error("Pitch flatten preview failed", error);
    localError.value = t("pitchPreviewFailed");
  } finally {
    isProcessing.value = false;
  }
}

function schedulePitchPreviewRefresh(delayMs = 80) {
  if (pitchPreviewTimer !== null) {
    window.clearTimeout(pitchPreviewTimer);
  }

  pitchPreviewTimer = window.setTimeout(() => {
    pitchPreviewTimer = null;
    if (activeTool.value !== "flatten" || !canPreviewFlatten.value) return;
    void refreshPitchFlattenPreview(false);
  }, delayMs);
}

async function saveToProject() {
  const bytes = workingBytes.value;
  if (!bytes || !asset.value) return;

  isProcessing.value = true;
  localError.value = "";
  try {
    const metadata = (
      await decodeAudioBytesWithNativeFallback(bytes, {
        path: asset.value.originalPath,
        fileName: asset.value.fileName,
      })
    ).buffer;
    assetPayloadStore.setPayload(props.assetId, bytes);
    if (asset.value.objectUrl) {
      URL.revokeObjectURL(asset.value.objectUrl);
    }
    asset.value.objectUrl = createAudioObjectUrl(bytes);
    projectStore.updateAsset(props.assetId, {
      format: "wav",
      fileName: asset.value.fileName.replace(/\.(wav|ogg)$/i, ".wav"),
      packagedPath: asset.value.packagedPath.replace(/\.(wav|ogg)$/i, ".wav"),
      size: bytes.byteLength,
      durationSec: metadata.duration,
      sampleRate: metadata.sampleRate,
      channels: metadata.numberOfChannels,
    });
    savedSnapshot.value = undoStack.value[undoStack.value.length - 1] ?? null;
    emit("saved");
  } catch (error) {
    console.error("Audio save failed", error);
    localError.value = t("saveFailed");
  } finally {
    isProcessing.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, select, textarea, button, a, [role='slider']"))) return;
  if ((event.code === "Space" || event.key === " ") && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat && !showDiscardConfirm.value) {
    event.preventDefault();
    if (isProcessing.value || !workingBytes.value) return;
    if (activeTool.value === "loop") togglePlayback();
    else if (activeTool.value === "flatten") togglePitchPlayback();
    else void spectralEditor.value?.togglePlay();
    return;
  }
  const withCommand = event.ctrlKey || event.metaKey;
  if (!withCommand) return;

  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      applyRedo();
    } else {
      applyUndo();
    }
    return;
  }

  if (key === "y") {
    event.preventDefault();
    applyRedo();
  }
}

watch(
  [() => props.assetId, sourceBytes],
  async ([assetId, bytes]) => {
    if (loadedAssetId.value === assetId && workingBytes.value) return;
    if (!bytes) {
      localError.value = t("payloadMissing");
      return;
    }

    if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
    undoStack.value = [];
    redoStack.value = [];
    await setWorkingBytes(bytes, t("openAudioHistory"));
    if (workingBytes.value) {
      sourceUrl.value = createAudioObjectUrl(workingBytes.value, audioTypeForBytes(workingBytes.value));
    }
    savedSnapshot.value = undoStack.value[undoStack.value.length - 1] ?? null;
    loopStart.value = 0;
    loopEnd.value = Math.max(0.001, durationSec.value);
    isCanvasReady.value = true;
    loadedAssetId.value = assetId;
  },
  { immediate: true },
);

watch(
  [loopStart, loopEnd, playheadSec, activeTool],
  () => {
    normalizeLoopSelection();
    scheduleWaveformRender();
  },
  { flush: "post" },
);

watch([loopStart, loopEnd, loopMode, loopFadeMs], () => {
  loopPlaybackBuffer = null;
  if (loopPreviewTimer !== null) window.clearTimeout(loopPreviewTimer);
  const refreshPlayingLoop = isPlaying.value && listenMode.value === "loop";
  if (refreshPlayingLoop) {
    loopPreviewTimer = window.setTimeout(() => {
      loopPreviewTimer = null;
      if (activeTool.value === "loop" && !isProcessing.value && isPlaying.value && listenMode.value === "loop") {
        previewLoop();
      }
    }, 180);
  }
});

watch(activeTool, () => pauseWorking());
watch(() => i18n.language, scheduleWaveformRender);

onMounted(() => {
  window.addEventListener("keydown", handleKeydown, { capture: true });

  if (waveformFrame.value) {
    resizeObserver = new ResizeObserver(() => scheduleWaveformRender());
    resizeObserver.observe(waveformFrame.value);
  }
});

onBeforeUnmount(() => {
  pauseWorking();
  if (loopAudioContext) void loopAudioContext.close();
  window.removeEventListener("keydown", handleKeydown, { capture: true });
  resizeObserver?.disconnect();
  if (pitchPreviewTimer !== null) window.clearTimeout(pitchPreviewTimer);
  if (loopPreviewTimer !== null) window.clearTimeout(loopPreviewTimer);
  if (renderFrame !== null) window.cancelAnimationFrame(renderFrame);
  if (workingUrl.value) URL.revokeObjectURL(workingUrl.value);
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
  revokePreviewUrls();
});
</script>

<template>
  <main class="audio-editor-shell">
    <header class="audio-titlebar">
      <button class="icon-button back-button" type="button" :title="t('back')" :aria-label="t('back')" :disabled="isProcessing" @click="requestReturnEditor">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18 9 12l6-6" />
        </svg>
      </button>
      <div class="title-text">
        <h1>{{ t('title') }}</h1>
        <p>{{ track?.name ?? t('track') }} / {{ asset?.fileName ?? t('audio') }}</p>
      </div>
      <span class="save-status">{{ isDirty ? `● ${t('unsavedChanges')}` : t('savedInProject') }}</span>
      <div class="title-actions">
        <button type="button" :disabled="!canUndo || isProcessing" @click="applyUndo">
          {{ t('undo') }}
        </button>
        <button type="button" :disabled="!canRedo || isProcessing" @click="applyRedo">
          {{ t('redo') }}
        </button>
        <button class="primary" type="button" :disabled="!workingBytes || !isDirty || isProcessing" @click="saveToProject">
          {{ isProcessing ? t('working') : t('saveToProject') }}
        </button>
      </div>
    </header>

    <section class="audio-body">
      <section class="editor-main">
        <nav class="tool-tabs" :aria-label="t('audioTools')">
          <button
            type="button"
            :class="{ active: activeTool === 'loop' }"
            @click="activeTool = 'loop'"
          >
            {{ t('loopMaker') }}
          </button>
          <button
            type="button"
            :class="{ active: activeTool === 'flatten' }"
            @click="activeTool = 'flatten'"
          >
            {{ t('pitchFlattener') }}
          </button>
          <button type="button" :class="{ active: activeTool === 'spectral' }" @click="activeTool = 'spectral'">{{ t('spectralEditor') }}</button>
        </nav>

        <SpectralEditorPanel
          v-if="activeTool === 'spectral'"
          ref="spectralEditor"
          class="spectral-editor-slot"
          :buffer="workingBuffer"
          :source-url="workingUrl"
          :spectrogram="workingSpectrogram"
          :disabled="isProcessing"
          @apply="applySpectralResult"
        />

        <section
          v-show="activeTool !== 'spectral'"
          ref="waveformFrame"
          class="waveform-card"
          :class="{ 'flatten-card': activeTool === 'flatten' }"
        >
          <div class="waveform-header">
            <div>
              <h2>{{ activeTool === "loop" ? t('loopSelection') : t('pitchFlattener') }}</h2>
              <p v-if="activeTool === 'loop'">{{ t('loopSelectionSummary', { selected: formatTime(selectionDuration), result: formatTime(renderedDuration) }) }}</p>
              <p v-else>
                {{ pitchStepLabel }} · {{ t('pitchChange', { semitones: flattenSemitones.toFixed(2), octaves: flattenOctaves.toFixed(3) }) }}
              </p>
            </div>
            <div v-if="activeTool === 'loop'" class="loop-transport">
              <div class="listen-switch" :aria-label="t('listenTo')">
                <button type="button" :class="{ active: listenMode === 'source' }" :disabled="isProcessing" @click="selectListenMode('source')">{{ t('original') }}</button>
                <button type="button" :class="{ active: listenMode === 'working' }" :disabled="isProcessing" @click="selectListenMode('working')">{{ t('workingAudio') }}</button>
                <button type="button" :class="{ active: listenMode === 'loop' }" :disabled="isProcessing" @click="selectListenMode('loop')">{{ t('loop') }}</button>
              </div>
              <button class="play-button" type="button" :disabled="isProcessing || !workingBytes" @click="togglePlayback">{{ isPlaying ? t('pause') : t('play') }}</button>
            </div>
            <div v-else class="pitch-header-actions">
              <div class="pitch-path-switch">
                <span>{{ t('path') }}</span>
                <div class="listen-switch" :aria-label="t('pitchPath')">
                  <button type="button" :class="{ active: pitchCurveMode === 'line' }" :aria-pressed="pitchCurveMode === 'line'" @click="setPitchCurveMode('line')">{{ t('straight') }}</button>
                  <button type="button" :class="{ active: pitchCurveMode === 'bezier' }" :aria-pressed="pitchCurveMode === 'bezier'" @click="setPitchCurveMode('bezier')">{{ t('bezier') }}</button>
                </div>
              </div>
              <div class="loop-transport">
                <div class="listen-switch" :aria-label="t('comparePitch')">
                  <button type="button" :class="{ active: pitchListenMode === 'working' }" :disabled="isProcessing" @click="selectPitchListenMode('working')">{{ t('current') }}</button>
                  <button type="button" :class="{ active: pitchListenMode === 'preview' }" :disabled="isProcessing || !canPreviewFlatten" @click="selectPitchListenMode('preview')">{{ t('result') }}</button>
                </div>
                <button class="play-button" type="button" :disabled="isProcessing || (pitchListenMode === 'preview' && !canPreviewFlatten)" @click="togglePitchPlayback">{{ isPlaying ? t('pause') : t('play') }}</button>
              </div>
            </div>
          </div>

          <div class="time-ruler" aria-hidden="true">
            <span>{{ formatTime(activeTool === 'loop' ? viewStartSec : 0) }}</span>
            <span>{{ formatTime(activeTool === 'loop' ? viewStartSec + viewDurationSec / 2 : durationSec / 2) }}</span>
            <span>{{ formatTime(activeTool === 'loop' ? viewEndSec : durationSec) }}</span>
          </div>

          <canvas
            v-if="activeTool === 'loop'"
            ref="waveformCanvas"
            class="waveform-canvas"
            :class="{ ready: isCanvasReady }"
            :title="t('loopCanvasHint')"
            @pointerdown="handleWaveformPointerDown"
            @pointermove="handleWaveformPointerMove"
            @pointerup="handleWaveformPointerUp"
            @pointercancel="handleWaveformPointerUp"
            @wheel="handleWaveformWheel"
          />

          <div v-else class="pitch-spectra">
            <section class="pitch-spectrum-panel">
              <header><strong>{{ t('currentAudio') }}</strong><span :class="{ 'pitch-warning': pitchSelectionWarning }" :title="pitchSelectionWarning || t('pitchCanvasHint')">{{ pitchSelectionWarning || t('pitchCanvasHint') }}</span></header>
              <canvas
                ref="waveformCanvas"
                class="waveform-canvas"
                :title="t('pitchMarkersHint')"
                @pointerdown="handleWaveformPointerDown"
                @pointermove="handleWaveformPointerMove"
                @pointerup="handleWaveformPointerUp"
                @pointercancel="handleWaveformPointerUp"
              />
            </section>
            <section class="pitch-spectrum-panel">
              <header><strong>{{ t('flattenedPreview') }}</strong><span>{{ flattenPreviewBytes && expectedFlatFrequency ? t('targetHz', { hz: Math.round(expectedFlatFrequency) }) : t('setTwoPoints') }}</span></header>
              <canvas ref="flattenPreviewCanvas" class="waveform-canvas pitch-preview-canvas" />
            </section>
          </div>

          <div v-if="activeTool === 'loop'" class="detail-row">
            <section>
              <header>
                <span>{{ t('startDetail') }}</span>
                <strong>{{ loopStartSample }}</strong>
              </header>
              <canvas ref="startDetailCanvas" class="detail-canvas" @pointerdown="handleDetailPointerDown('start', $event)" @pointermove="handleDetailPointerMove('start', $event)" @pointerup="handleDetailPointerUp" @pointercancel="handleDetailPointerUp" />
            </section>
            <section>
              <header>
                <span>{{ t('endDetail') }}</span>
                <strong>{{ loopEndSample }}</strong>
              </header>
              <canvas ref="endDetailCanvas" class="detail-canvas" @pointerdown="handleDetailPointerDown('end', $event)" @pointermove="handleDetailPointerMove('end', $event)" @pointerup="handleDetailPointerUp" @pointercancel="handleDetailPointerUp" />
            </section>
            <section>
              <header><span>{{ t('sourceSeam') }}</span></header>
              <canvas ref="seamDetailCanvas" class="detail-canvas seam-detail" />
            </section>
          </div>

          <div v-if="activeTool === 'loop'" class="overview-toolbar">
            <span>{{ t('overviewHint') }}</span>
            <div>
              <button type="button" :disabled="zoomLevel <= 1" @click="setZoom(zoomLevel / 1.5)">−</button>
              <span>{{ zoomLevel.toFixed(1) }}×</span>
              <button type="button" :disabled="zoomLevel >= 64" @click="setZoom(zoomLevel * 1.5)">+</button>
            </div>
          </div>
          <canvas ref="overviewCanvas" class="overview-canvas" @pointerdown="handleOverviewPointerDown" />
        </section>

        <section v-show="activeTool !== 'spectral'" class="tool-strip" :class="{ 'pitch-tool-strip': activeTool === 'flatten' }">
          <template v-if="activeTool === 'loop'">
            <label>
              <span>{{ t('loopStart') }}</span>
              <input v-model.number="loopStart" type="number" min="0" step="0.001" />
            </label>
            <label>
              <span>{{ t('loopEnd') }}</span>
              <input v-model.number="loopEnd" type="number" min="0.001" step="0.001" />
            </label>
            <label>
              <span>{{ t('mode') }}</span>
              <select v-model="loopMode">
                <option value="normal">{{ t('normal') }}</option>
                <option value="pingpong">{{ t('pingPong') }}</option>
              </select>
            </label>
            <label>
              <span>{{ t('crossfadeMs') }}</span>
              <input v-model.number="loopFadeMs" type="number" min="0" step="1" :disabled="loopMode === 'pingpong'" />
            </label>
            <button class="primary" type="button" :disabled="isProcessing || !workingBytes" @click="applyLoopRender">
              {{ t('applyLoop') }}
            </button>
          </template>

          <template v-else>
            <label>
              <span>{{ t('endPitchDifference') }}</span>
              <input :value="flattenSemitones" type="number" min="-72" max="72" step="0.1" :disabled="isProcessing || !canPreviewFlatten" @change="setFlattenSemitones(Number(($event.target as HTMLInputElement).value))" />
            </label>
            <button type="button" @click="clearPitchReferencePoints">
              {{ t('clearPoints') }}
            </button>
            <button type="button" :disabled="isProcessing || !canPreviewFlatten" @click="previewPitchFlatten">
              {{ t('updatePreview') }}
            </button>
            <button class="primary" type="button" :disabled="isProcessing || !flattenPreviewBytes" @click="applyPitchFlatten">
              {{ t('applyResult') }}
            </button>
          </template>
        </section>
      </section>

      <aside class="inspector">
        <section class="inspector-section">
          <h2>{{ t('file') }}</h2>
          <dl>
            <dt>{{ t('name') }}</dt>
            <dd>{{ asset?.fileName ?? "-" }}</dd>
            <dt>{{ t('duration') }}</dt>
            <dd>{{ durationLabel }}</dd>
            <dt>{{ t('sampleRate') }}</dt>
            <dd>{{ workingBuffer?.sampleRate ?? "-" }} Hz</dd>
            <dt>{{ t('channels') }}</dt>
            <dd>{{ workingBuffer?.numberOfChannels ?? "-" }}</dd>
          </dl>
        </section>

        <template v-if="activeTool === 'loop'">
          <audio ref="sourceAudio" class="hidden-audio" :src="sourceUrl" @timeupdate="handleSourceTimeUpdate" @ended="isPlaying = false" />
          <audio ref="workingAudio" class="hidden-audio" :src="workingUrl" @timeupdate="handleWorkingTimeUpdate" @ended="isPlaying = false" />
        </template>
        <template v-else>
          <audio ref="workingAudio" class="hidden-audio" :src="workingUrl" @timeupdate="handleWorkingTimeUpdate" @ended="isPlaying = false" />
          <audio ref="flattenPreviewAudio" class="hidden-audio" :src="flattenPreviewUrl" @timeupdate="handleFlattenPreviewTimeUpdate" @ended="isPlaying = false" />
        </template>

        <section v-if="(activeTool === 'flatten' && pitchSelectionWarning) || localError" class="inspector-section">
          <p v-if="activeTool === 'flatten' && pitchSelectionWarning" class="pitch-warning">{{ pitchSelectionWarning }}</p>
          <p v-if="localError" class="error">{{ localError }}</p>
        </section>

        <section v-if="activeTool === 'loop'" class="inspector-section">
          <h2>{{ t('edgeNudge') }}</h2>
          <div class="nudge-steps" :aria-label="t('nudgeStep')">
            <button type="button" :class="{ active: nudgeStep === 'sample' }" :aria-pressed="nudgeStep === 'sample'" @click="nudgeStep = 'sample'">{{ t('oneSample') }}</button>
            <button type="button" :class="{ active: nudgeStep === 'ms1' }" :aria-pressed="nudgeStep === 'ms1'" @click="nudgeStep = 'ms1'">{{ t('oneMs') }}</button>
            <button type="button" :class="{ active: nudgeStep === 'ms10' }" :aria-pressed="nudgeStep === 'ms10'" @click="nudgeStep = 'ms10'">{{ t('tenMs') }}</button>
          </div>
          <div class="nudge-grid">
            <span>{{ t('start') }}</span>
            <button type="button" :aria-label="t('moveStartEarlier', { step: nudgeLabel })" @click="nudgeLoopPoint('start', -1)">−{{ nudgeLabel }}</button>
            <button type="button" :aria-label="t('moveStartLater', { step: nudgeLabel })" @click="nudgeLoopPoint('start', 1)">+{{ nudgeLabel }}</button>
            <span>{{ t('end') }}</span>
            <button type="button" :aria-label="t('moveEndEarlier', { step: nudgeLabel })" @click="nudgeLoopPoint('end', -1)">−{{ nudgeLabel }}</button>
            <button type="button" :aria-label="t('moveEndLater', { step: nudgeLabel })" @click="nudgeLoopPoint('end', 1)">+{{ nudgeLabel }}</button>
          </div>
        </section>

        <section v-else-if="activeTool === 'flatten'" class="inspector-section">
          <h2>{{ t('referencePoints') }}</h2>
          <dl>
            <dt>{{ t('start') }}</dt>
            <dd>
              {{
                pitchReferencePoints[0]
                  ? `${formatTime(pitchReferencePoints[0].time)}, ${Math.round(pitchReferencePoints[0].frequency)} Hz`
                  : "-"
              }}
            </dd>
            <dt>{{ t('end') }}</dt>
            <dd>
              {{
                pitchReferencePoints[1]
                  ? `${formatTime(pitchReferencePoints[1].time)}, ${Math.round(pitchReferencePoints[1].frequency)} Hz`
                  : "-"
              }}
            </dd>
            <dt>{{ t('path') }}</dt>
            <dd>{{ pitchCurveMode === 'line' ? t('straight') : t('bezier') }}</dd>
            <dt>{{ t('difference') }}</dt>
            <dd>{{ t('semitonesValue', { value: flattenSemitones.toFixed(2) }) }}</dd>
          </dl>
        </section>
      </aside>
    </section>
    <div v-if="showDiscardConfirm" class="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="discard-title">
      <div class="confirm-dialog">
        <h2 id="discard-title">{{ t('discardTitle') }}</h2>
        <p>{{ t('discardMessage') }}</p>
        <div>
          <button type="button" @click="showDiscardConfirm = false">{{ t('keepEditing') }}</button>
          <button type="button" class="discard-button" @click="emit('return-editor')">{{ t('discardChanges') }}</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.audio-editor-shell {
  position: relative;
  display: grid;
  grid-template-rows: var(--app-titlebar-height) 1fr;
  width: 100%;
  height: 100vh;
  min-width: 1040px;
  min-height: 660px;
  color: #f5f8fb;
  background: #29323a;
}

.audio-titlebar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: var(--app-titlebar-padding);
  background: var(--app-titlebar-bg);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04);
}

.icon-button,
.title-actions button,
.tool-tabs button,
.transport-actions button,
.tool-strip button {
  color: inherit;
  background: #172129;
  border: 0;
  border-radius: 5px;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
}

.icon-button svg,
.transport-actions svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.icon-button svg {
  width: 22px;
  height: 22px;
}

.title-text {
  display: grid;
  gap: 2px;
}

.title-text h1,
.title-text p,
.waveform-header h2,
.waveform-header p,
.inspector h2,
.inspector dl,
.hint,
.inline-hint {
  margin: 0;
}

.title-text h1 {
  font-size: 27px;
  line-height: 1;
  letter-spacing: 0;
}

.title-text p,
.waveform-header p,
.hint,
.inline-hint,
.inspector dt {
  color: rgba(245, 248, 251, 0.64);
}

.title-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.title-actions button,
.tool-strip button {
  height: 36px;
  padding: 0 14px;
}

button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

button:disabled {
  cursor: default;
  opacity: 0.45;
}

.primary {
  background: #3d6074 !important;
}

.audio-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 292px;
  min-height: 0;
}

.editor-main {
  display: grid;
  grid-template-rows: 52px minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
}

.spectral-editor-slot { grid-row: 2 / span 2; }

.tool-tabs {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 0 20px;
  background: #25323b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tool-tabs button {
  height: 34px;
  min-width: 132px;
  padding: 0 14px;
}

.tool-tabs button.active {
  color: #f8fcff;
  background: #3d6074;
}

.waveform-card {
  display: grid;
  grid-template-rows: auto 22px minmax(220px, 1fr) 124px 28px 52px;
  min-height: 0;
  margin: 20px;
  overflow: hidden;
  background: #2f3d4a;
  border: 1px solid rgba(178, 213, 230, 0.12);
  border-radius: 8px;
}

.waveform-card.flatten-card {
  grid-template-rows: auto 22px minmax(340px, 1fr) 52px;
}

.pitch-spectra {
  display: grid;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-height: 0;
  padding: 0 10px 10px;
}

.pitch-spectrum-panel {
  display: grid;
  grid-template-rows: 25px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  background: #344453;
  border: 1px solid rgba(178, 213, 230, 0.14);
  border-radius: 5px;
}

.pitch-spectrum-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  color: rgba(245, 248, 251, 0.72);
  font-size: 12px;
}

.pitch-spectrum-panel header span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pitch-warning { color: #ffca80 !important; }

.pitch-preview-canvas { cursor: default; }

.waveform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px 10px;
}

.waveform-header h2,
.inspector h2 {
  font-size: 17px;
  letter-spacing: 0;
}

.transport-actions {
  display: flex;
  gap: 8px;
}

.transport-actions button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
}

.transport-actions svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
  stroke: none;
}

.time-ruler {
  display: flex;
  justify-content: space-between;
  padding: 0 16px;
  color: rgba(245, 248, 251, 0.52);
  font-size: 12px;
}

.waveform-canvas,
.overview-canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  touch-action: none;
}

.waveform-canvas {
  cursor: crosshair;
}

.overview-canvas {
  border-top: 1px solid rgba(178, 213, 230, 0.1);
}

.tool-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(92px, 1fr)) auto auto;
  gap: 10px;
  align-items: end;
  padding: 0 20px 20px;
}

.pitch-tool-strip {
  grid-template-columns: minmax(180px, 1fr) repeat(3, auto);
}

.pitch-header-actions, .pitch-path-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pitch-header-actions { flex-wrap: wrap; justify-content: flex-end; }
.pitch-path-switch > span { color: rgba(245, 248, 251, 0.72); font-size: 13px; }

.tool-strip label,
.inspector label {
  display: grid;
  gap: 7px;
}

.tool-strip span,
.inspector label span {
  color: rgba(245, 248, 251, 0.72);
  font-size: 13px;
}

.tool-strip input,
.tool-strip select {
  height: 36px;
  min-width: 0;
  padding: 0 10px;
  color: inherit;
  background: #172129;
  border: 1px solid rgba(178, 213, 230, 0.12);
  border-radius: 5px;
}

.wide-field {
  grid-column: span 2;
}

.inline-hint {
  align-self: center;
  font-size: 13px;
}

.inspector {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 0;
  padding: 18px;
  overflow: auto;
  background: #25323b;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
}

.inspector-section {
  display: grid;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.inspector dl {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 7px 10px;
}

.inspector dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspector audio {
  width: 100%;
  height: 34px;
}

.nudge-grid {
  display: grid;
  grid-template-columns: 54px 1fr 1fr;
  gap: 8px;
  align-items: center;
}

.nudge-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin: 12px 0; }
.nudge-steps button { min-width: 0; height: 30px; padding: 0 4px; color: inherit; background: #172129; border: 0; border-radius: 5px; font-size: 12px; }
.nudge-steps button.active { background: #3d6074; }

.nudge-grid span {
  color: rgba(245, 248, 251, 0.72);
}

.nudge-grid button {
  height: 30px;
  color: inherit;
  background: #172129;
  border: 0;
  border-radius: 5px;
}

.detail-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid rgba(178, 213, 230, 0.1);
}

.detail-row section {
  display: grid;
  grid-template-rows: 22px 1fr;
  min-width: 0;
  overflow: hidden;
  background: rgba(23, 33, 41, 0.35);
  border: 1px solid rgba(178, 213, 230, 0.1);
  border-radius: 5px;
}

.detail-row header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  color: rgba(245, 248, 251, 0.64);
  font-size: 12px;
}

.detail-row strong {
  color: #ffe59b;
  font-weight: 600;
}

.detail-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.error {
  margin: 0;
  padding: 10px 12px;
  color: #ffcaca;
  background: rgba(150, 55, 55, 0.18);
  border: 1px solid rgba(255, 143, 143, 0.22);
  border-radius: 6px;
}

.save-status {
  margin-left: auto;
  color: #bed1dc;
  font-size: 13px;
}

.title-actions { margin-left: 0; }
.loop-transport, .listen-switch, .overview-toolbar, .overview-toolbar div { display: flex; align-items: center; }
.loop-transport { gap: 8px; }
.listen-switch { gap: 2px; padding: 3px; background: #172129; border-radius: 6px; }
.listen-switch button, .play-button, .overview-toolbar button {
  height: 28px; padding: 0 10px; color: inherit; background: transparent; border: 0; border-radius: 4px;
}
.listen-switch button.active, .play-button { background: #3d6074; }
.overview-toolbar {
  justify-content: space-between; padding: 0 12px; color: rgba(245, 248, 251, 0.64);
  font-size: 12px; border-top: 1px solid rgba(178, 213, 230, 0.1);
}
.overview-toolbar div { gap: 8px; }
.overview-toolbar button { width: 26px; padding: 0; font-size: 18px; }
.overview-canvas { cursor: pointer; }
.detail-canvas { cursor: ew-resize; touch-action: none; }
.seam-detail { cursor: default; }
.hidden-audio { display: none; }
.confirm-backdrop {
  position: absolute; z-index: 10; display: grid; place-items: center; inset: 0;
  background: rgba(8, 15, 20, 0.72);
}
.confirm-dialog {
  width: min(400px, calc(100vw - 32px)); padding: 24px; background: #2f3d4a;
  border: 1px solid rgba(178, 213, 230, 0.2); border-radius: 8px;
}
.confirm-dialog h2, .confirm-dialog p { margin: 0 0 14px; }
.confirm-dialog div { display: flex; justify-content: flex-end; gap: 8px; }
.confirm-dialog button {
  padding: 8px 12px; color: inherit; background: #172129; border: 0; border-radius: 5px;
}
.confirm-dialog .discard-button { background: #79454a; }
</style>
