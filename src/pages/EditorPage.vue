<script setup lang="ts">
import Konva from "konva";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEditorStore } from "@/stores/editor";
import { useHistoryStore } from "@/stores/history";
import { useProjectStore } from "@/stores/project";
import { AudioPreviewEngine } from "@/services/audioPreview";
import { APP_VERSION } from "@/types/project";
import type {
  CurveKind,
  CurveSetKind,
  Keyframe,
  Track,
  TrackCurve,
} from "@/types/track";

import iconMute from "@/assets/icons/mute.png";
import iconOpenFile from "@/assets/icons/openfile.png";
import iconUnmute from "@/assets/icons/unmute.png";
import iconSelect from "@/assets/icons/select.png";
import iconMove from "@/assets/icons/move.png";
import iconKeyframe from "@/assets/icons/keyframe.png";
import iconPreviewOpen from "@/assets/icons/preview-open.png";
import iconPreviewClose from "@/assets/icons/preview-close.png";

const emit = defineEmits<{ "return-home": [] }>();

interface ChartConfig {
  kind: CurveKind;
  label: string;
  unit: string;
  maxValue: number;
}

interface ChartRuntime {
  stage: Konva.Stage;
  layer: Konva.Layer;
  config: ChartConfig;
}

const projectStore = useProjectStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();
const audioEngine = new AudioPreviewEngine();

const pitchChartEl = ref<HTMLDivElement | null>(null);
const volumeChartEl = ref<HTMLDivElement | null>(null);
const audioInput = ref<HTMLInputElement | null>(null);
const speedDraft = ref("0.0");
const toast = ref("");

const charts = new Map<CurveKind, ChartRuntime>();
const resizeObservers: ResizeObserver[] = [];
let animationFrame: number | null = null;
let lastFrameTime = 0;
let isDraggingKeyframe = false;

const pitchConfig: ChartConfig = {
  kind: "pitch",
  label: "Pitch",
  unit: "Hz",
  maxValue: 3.5,
};
const volumeConfig: ChartConfig = {
  kind: "volume",
  label: "Volume",
  unit: "dB",
  maxValue: 2,
};

const meta = computed(() => projectStore.meta);
const tracks = computed(() => projectStore.tracks);
const assets = computed(() => projectStore.assets);
const activeTrack = computed(() => projectStore.activeTrack);
const activeTrackId = computed(() => projectStore.activeTrackId);
const selectedKeyframe = computed(() => editorStore.selection.selectedKeyframe);
const activeCurveSet = computed<CurveSetKind>(() => editorStore.activeCurveSet);
const selectedPoint = computed(() => {
  const selected = selectedKeyframe.value;
  const track = tracks.value.find((item) => item.id === selected?.trackId);

  if (!selected || !track) return null;

  return (
    track.curveSets[selected.curveSet][selected.kind].keyframes.find(
      (keyframe) => keyframe.id === selected.keyframeId,
    ) ?? null
  );
});

const activeAssetName = computed(() => {
  const track = activeTrack.value;
  if (!track?.assetId) return "No file";

  return (
    assets.value.find((asset) => asset.id === track.assetId)?.fileName ??
    "No file"
  );
});

const modeLabel = computed(() => {
  const mode = editorStore.simulator.mode;
  if (mode === "traction") return "Traction";
  if (mode === "brake") return "Brake";
  return "Coasting";
});

function showToast(message: string) {
  toast.value = message;
  window.setTimeout(() => {
    if (toast.value === message) toast.value = "";
  }, 2400);
}

function pushHistory(label: string) {
  historyStore.pushSnapshot(label, projectStore.document, editorStore.runtime);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sortedKeyframes(curve: TrackCurve): Keyframe[] {
  return [...curve.keyframes].sort((a, b) => a.speed - b.speed);
}

function sampleCurve(curve: TrackCurve, speed: number): number {
  const keyframes = sortedKeyframes(curve);

  if (keyframes.length === 0) return curve.kind === "pitch" ? 1 : 0;
  if (speed <= keyframes[0].speed) return keyframes[0].value;

  for (let index = 1; index < keyframes.length; index += 1) {
    const previous = keyframes[index - 1];
    const next = keyframes[index];

    if (speed <= next.speed) {
      const span = next.speed - previous.speed;
      const ratio = span === 0 ? 0 : (speed - previous.speed) / span;
      return previous.value + (next.value - previous.value) * ratio;
    }
  }

  return keyframes[keyframes.length - 1].value;
}

function syncAudioPreview() {
  audioEngine.update(
    tracks.value,
    activeCurveSet.value,
    editorStore.simulator.currentSpeed,
  );
}

function chartBounds(stage: Konva.Stage) {
  return {
    left: 72,
    top: 24,
    right: stage.width() - 24,
    bottom: stage.height() - 42,
  };
}

function pointToCanvas(
  stage: Konva.Stage,
  config: ChartConfig,
  speed: number,
  value: number,
) {
  const bounds = chartBounds(stage);
  const maxSpeed = editorStore.simulator.maxSpeed || 1;
  const x =
    bounds.left +
    (clamp(speed, 0, maxSpeed) / maxSpeed) * (bounds.right - bounds.left);
  const y =
    bounds.bottom -
    (clamp(value, 0, config.maxValue) / config.maxValue) *
      (bounds.bottom - bounds.top);

  return { x, y };
}

function canvasToPoint(stage: Konva.Stage, config: ChartConfig, x: number, y: number) {
  const bounds = chartBounds(stage);
  const maxSpeed = editorStore.simulator.maxSpeed || 1;
  const speed =
    ((clamp(x, bounds.left, bounds.right) - bounds.left) /
      (bounds.right - bounds.left)) *
    maxSpeed;
  const value =
    ((bounds.bottom - clamp(y, bounds.top, bounds.bottom)) /
      (bounds.bottom - bounds.top)) *
    config.maxValue;

  return { speed, value };
}

function curvePoints(stage: Konva.Stage, config: ChartConfig, curve: TrackCurve) {
  return sortedKeyframes(curve).flatMap((keyframe) => {
    const point = pointToCanvas(stage, config, keyframe.speed, keyframe.value);
    return [point.x, point.y];
  });
}

function isVisibleTrack(track: Track) {
  return track.visible !== false;
}

function isEditableTrack(track: Track) {
  return track.id === activeTrackId.value && isVisibleTrack(track);
}

function setStageCursor(runtime: ChartRuntime) {
  const canMove =
    editorStore.view.tool === "move" &&
    activeTrack.value !== null &&
    activeTrack.value.visible !== false;

  runtime.stage.container().style.cursor = canMove ? "move" : "default";
}

function resizeStage(runtime: ChartRuntime, container: HTMLDivElement) {
  const width = Math.max(420, container.clientWidth);
  const height = Math.max(220, container.clientHeight);
  runtime.stage.size({ width, height });
  renderChart(runtime);
}

function createStage(container: HTMLDivElement, config: ChartConfig) {
  const stage = new Konva.Stage({
    container,
    width: Math.max(420, container.clientWidth),
    height: Math.max(220, container.clientHeight),
  });
  const layer = new Konva.Layer();
  stage.add(layer);

  const runtime = { stage, layer, config };
  charts.set(config.kind, runtime);

  stage.on("click tap", () => handleChartClick(runtime));
  stage.on("mouseleave", () => {
    editorStore.hoverKeyframe(null);
    setStageCursor(runtime);
  });
  stage.on("contextmenu", (event) => {
    event.evt.preventDefault();
    handleChartContextMenu(runtime, event.target);
  });

  const observer = new ResizeObserver(() => resizeStage(runtime, container));
  observer.observe(container);
  resizeObservers.push(observer);
  renderChart(runtime);
}

function handleChartClick(runtime: ChartRuntime) {
  const pointer = runtime.stage.getPointerPosition();
  if (!pointer || isDraggingKeyframe) return;

  const target = runtime.stage.getIntersection(pointer);
  const trackId = target?.attrs.trackId as string | undefined;
  const keyframeId = target?.attrs.keyframeId as string | undefined;
  const active = activeTrack.value;

  if (editorStore.view.tool === "select") {
    if (trackId && (!active || active.id === trackId)) {
      activateTrack(trackId);

      if (keyframeId) {
        editorStore.selectKeyframe({
          trackId,
          curveSet: activeCurveSet.value,
          kind: runtime.config.kind,
          keyframeId,
        });
      }

      renderCharts();
      return;
    }

    const point = canvasToPoint(
      runtime.stage,
      runtime.config,
      pointer.x,
      pointer.y,
    );
    editorStore.setCurrentSpeed(point.speed);
    syncAudioPreview();
    renderCharts();
    return;
  }

  if (!active || active.visible === false) return;

  if (keyframeId && trackId === active.id) {
    editorStore.selectKeyframe({
      trackId: active.id,
      curveSet: activeCurveSet.value,
      kind: runtime.config.kind,
      keyframeId,
    });
    renderCharts();
    return;
  }

  if (editorStore.view.tool !== "keyframe") return;

  const point = canvasToPoint(runtime.stage, runtime.config, pointer.x, pointer.y);
  const curve = active.curveSets[activeCurveSet.value][runtime.config.kind];
  const keyframe = projectStore.addKeyframe(
    active.id,
    activeCurveSet.value,
    runtime.config.kind,
    point.speed,
    Number.isFinite(point.value) ? point.value : sampleCurve(curve, point.speed),
  );

  if (keyframe) {
    editorStore.selectKeyframe({
      trackId: active.id,
      curveSet: activeCurveSet.value,
      kind: runtime.config.kind,
      keyframeId: keyframe.id,
    });
    pushHistory("Add keyframe");
  }

  syncAudioPreview();
  renderCharts();
}

function handleChartContextMenu(runtime: ChartRuntime, target: Konva.Node) {
  const active = activeTrack.value;
  if (!active || active.visible === false) return;

  const trackId = target.attrs.trackId as string | undefined;
  const keyframeId = target.attrs.keyframeId as string | undefined;

  if (
    editorStore.view.tool === "keyframe" &&
    keyframeId &&
    trackId === active.id
  ) {
    projectStore.removeKeyframe(
      active.id,
      activeCurveSet.value,
      runtime.config.kind,
      keyframeId,
    );
    editorStore.clearSelection();
    pushHistory("Delete keyframe");
    syncAudioPreview();
    renderCharts();
    return;
  }

  showToast("List view menu reserved");
}

function renderCharts() {
  charts.forEach((runtime) => renderChart(runtime));
}

function renderChart(runtime: ChartRuntime) {
  const { stage, layer, config } = runtime;
  const bounds = chartBounds(stage);
  const maxSpeed = editorStore.simulator.maxSpeed || 1;
  const hasActiveTrack = activeTrackId.value !== null;

  layer.destroyChildren();
  setStageCursor(runtime);
  layer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: stage.width(),
      height: stage.height(),
      fill: "#354252",
      cornerRadius: 6,
    }),
  );

  for (let index = 0; index <= 12; index += 1) {
    const x = bounds.left + ((bounds.right - bounds.left) / 12) * index;
    const speed = (maxSpeed / 12) * index;
    layer.add(
      new Konva.Line({
        points: [x, bounds.top, x, bounds.bottom],
        stroke: "rgba(189, 208, 219, 0.42)",
        strokeWidth: 1,
      }),
    );
    layer.add(
      new Konva.Text({
        x: x - 18,
        y: bounds.bottom + 8,
        width: 36,
        align: "center",
        text: String(Math.round(speed)),
        fontSize: 12,
        fill: "#F3F7FA",
      }),
    );
  }

  for (let index = 0; index <= 5; index += 1) {
    const y = bounds.bottom - ((bounds.bottom - bounds.top) / 5) * index;
    const value = (config.maxValue / 5) * index;
    layer.add(
      new Konva.Line({
        points: [bounds.left, y, bounds.right, y],
        stroke: "rgba(189, 208, 219, 0.42)",
        strokeWidth: 1,
      }),
    );
    layer.add(
      new Konva.Text({
        x: 10,
        y: y - 8,
        width: 52,
        align: "right",
        text: value === 0 ? "0" : value.toFixed(1),
        fontSize: 12,
        fill: "#F3F7FA",
      }),
    );
  }

  layer.add(
    new Konva.Text({
      x: (bounds.left + bounds.right) / 2 - 58,
      y: stage.height() - 22,
      width: 116,
      align: "center",
      text: "Speed (km/h)",
      fontSize: 14,
      fill: "#F3F7FA",
    }),
  );
  layer.add(
    new Konva.Text({
      x: 4,
      y: (bounds.top + bounds.bottom) / 2 + 42,
      text: `${config.label} (${config.unit})`,
      fontSize: 13,
      fill: "#F3F7FA",
      rotation: -90,
    }),
  );

  tracks.value.filter(isVisibleTrack).forEach((track) => {
    const curve = track.curveSets[activeCurveSet.value][config.kind];
    const keyframes = sortedKeyframes(curve);
    const points = curvePoints(stage, config, curve);
    const editable = isEditableTrack(track);
    const dimmed = hasActiveTrack && !editable;
    const opacity = dimmed ? 0.3 : 1;
    const selectable =
      editorStore.view.tool === "select" && (!hasActiveTrack || editable);

    if (points.length >= 4) {
      const line = new Konva.Line({
        points,
        stroke: track.color,
        strokeWidth: 3,
        lineCap: "round",
        lineJoin: "round",
        opacity,
        tension: 0,
        hitStrokeWidth: 14,
        listening: selectable,
        trackId: track.id,
        curveKind: config.kind,
      });

      layer.add(line);
    }

    keyframes.forEach((keyframe) => {
      const point = pointToCanvas(stage, config, keyframe.speed, keyframe.value);
      const isSelected =
        editable &&
        selectedKeyframe.value?.keyframeId === keyframe.id &&
        selectedKeyframe.value.trackId === track.id &&
        selectedKeyframe.value.kind === config.kind;
      const draggable = editorStore.view.tool === "move" && editable;
      const keyframeSelectable = selectable || draggable || editorStore.view.tool === "keyframe";
      const circle = new Konva.Circle({
        x: point.x,
        y: point.y,
        radius: isSelected ? 7 : 5,
        fill: isSelected ? "#FF5A5A" : track.color,
        stroke: "#FFFFFF",
        strokeWidth: isSelected ? 2 : 0,
        opacity,
        draggable,
        listening: keyframeSelectable && (!hasActiveTrack || editable),
        keyframeId: keyframe.id,
        trackId: track.id,
        curveKind: config.kind,
        dragBoundFunc(position) {
          return {
            x: clamp(position.x, bounds.left, bounds.right),
            y: clamp(position.y, bounds.top, bounds.bottom),
          };
        },
      });

      circle.on("mouseenter", () => {
        if (editorStore.view.tool === "select" && selectable) {
          runtime.stage.container().style.cursor = "pointer";
        } else if (draggable) {
          runtime.stage.container().style.cursor = "move";
        }

        editorStore.hoverKeyframe({
          trackId: track.id,
          curveSet: activeCurveSet.value,
          kind: config.kind,
          keyframeId: keyframe.id,
        });
      });
      circle.on("mouseleave", () => {
        setStageCursor(runtime);
        editorStore.hoverKeyframe(null);
      });
      circle.on("dragstart", () => {
        isDraggingKeyframe = true;
        editorStore.selectKeyframe({
          trackId: track.id,
          curveSet: activeCurveSet.value,
          kind: config.kind,
          keyframeId: keyframe.id,
        });
      });
      circle.on("dragmove", () => {
        const next = canvasToPoint(stage, config, circle.x(), circle.y());
        projectStore.moveKeyframeDraft(
          track.id,
          activeCurveSet.value,
          config.kind,
          keyframe.id,
          next,
        );

        const activeLine = layer
          .find("Line")
          .find(
            (node) =>
              node.attrs.trackId === track.id &&
              node.attrs.curveKind === config.kind,
          ) as Konva.Line | undefined;

        activeLine?.points(curvePoints(stage, config, curve));
        syncAudioPreview();
        layer.batchDraw();
      });
      circle.on("dragend", () => {
        const next = canvasToPoint(stage, config, circle.x(), circle.y());
        projectStore.updateKeyframe(
          track.id,
          activeCurveSet.value,
          config.kind,
          keyframe.id,
          next,
        );
        editorStore.selectKeyframe({
          trackId: track.id,
          curveSet: activeCurveSet.value,
          kind: config.kind,
          keyframeId: keyframe.id,
        });
        pushHistory("Move keyframe");
        isDraggingKeyframe = false;
        syncAudioPreview();
        renderCharts();
      });

      layer.add(circle);
    });
  });

  const playhead = pointToCanvas(
    stage,
    config,
    editorStore.simulator.currentSpeed,
    0,
  );
  layer.add(
    new Konva.Line({
      points: [playhead.x, bounds.top, playhead.x, bounds.bottom],
      stroke: "#F25B5B",
      strokeWidth: 2,
      dash: [6, 5],
    }),
  );

  layer.draw();
}

async function playTransport() {
  editorStore.play();
  const warnings = await audioEngine.start(
    tracks.value,
    assets.value,
    activeCurveSet.value,
    editorStore.simulator.currentSpeed,
  );

  if (warnings.length > 0) showToast(warnings[0]);
  startAnimationLoop();
}

function pauseTransport() {
  editorStore.pause();
  audioEngine.stop();
  stopAnimationLoop();
}

function toggleTransport() {
  if (editorStore.playback.transport === "playing") {
    pauseTransport();
  } else {
    void playTransport();
  }
}

function startAnimationLoop() {
  stopAnimationLoop();
  lastFrameTime = performance.now();
  animationFrame = requestAnimationFrame(tick);
}

function stopAnimationLoop() {
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function tick(timestamp: number) {
  if (editorStore.playback.transport !== "playing") return;

  const delta = Math.max(0, (timestamp - lastFrameTime) / 1000);
  lastFrameTime = timestamp;
  const simulator = editorStore.simulator;
  let nextSpeed = simulator.currentSpeed;
  let hitLimit = false;

  if (simulator.mode === "traction") {
    nextSpeed = simulator.currentSpeed + simulator.acceleration * delta;
    hitLimit = nextSpeed >= simulator.maxSpeed;
  } else if (simulator.mode === "brake") {
    nextSpeed = simulator.currentSpeed - simulator.brakeDeceleration * delta;
    hitLimit = nextSpeed <= 0;
  }

  editorStore.setCurrentSpeed(nextSpeed);
  syncAudioPreview();
  renderCharts();

  if (hitLimit) {
    pauseTransport();
    return;
  }

  animationFrame = requestAnimationFrame(tick);
}

function setMode(mode: "traction" | "coasting" | "brake") {
  editorStore.setSimulatorMode(mode);
  renderCharts();
  syncAudioPreview();
}

function setTool(tool: "select" | "move" | "keyframe") {
  if (tool !== "select" && !activeTrack.value) {
    showToast("Select a track first");
    return;
  }

  editorStore.setTool(tool);
  renderCharts();
}

function commitSpeed() {
  editorStore.setCurrentSpeed(Number(speedDraft.value));
  speedDraft.value = editorStore.simulator.currentSpeed.toFixed(1);
  syncAudioPreview();
  renderCharts();
}

function updateMaxSpeed(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  projectStore.setProjectMeta({ maxSpeed: value });
  editorStore.setMaxSpeed(value);
  pushHistory("Update max speed");
  renderCharts();
}

function updateAcceleration(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  projectStore.setProjectMeta({ acceleration: value });
  editorStore.setAcceleration(value);
  pushHistory("Update acceleration");
}

function activateTrack(trackId: string | null) {
  projectStore.setActiveTrack(trackId);
  editorStore.setActiveTrackId(trackId);

  if (!trackId) {
    editorStore.setTool("select");
  }

  syncAudioPreview();
  renderCharts();
}

function toggleTrackActivation(trackId: string) {
  activateTrack(trackId === activeTrackId.value ? null : trackId);
}

function addTrack() {
  const track = projectStore.addTrack();

  if (track) {
    activateTrack(track.id);
    pushHistory("Add track");
  }
}

function deleteActiveTrack() {
  const track = activeTrack.value;
  if (!track) return;

  projectStore.removeTrack(track.id);
  editorStore.clearActiveTrack();
  editorStore.setTool("select");
  pushHistory("Delete track");
  syncAudioPreview();
  renderCharts();
}

function updateTrackName(event: Event) {
  const track = activeTrack.value;
  if (!track) return;

  const input = event.target as HTMLInputElement;
  projectStore.updateTrack(track.id, { name: input.value.trim() || "motor" });
  pushHistory("Rename track");
}

function updateTrackColor(event: Event) {
  const track = activeTrack.value;
  if (!track) return;

  const input = event.target as HTMLInputElement;
  projectStore.updateTrack(track.id, { color: input.value });
  pushHistory("Update track color");
  renderCharts();
}

function toggleTrackMute(trackId: string) {
  const track = tracks.value.find((item) => item.id === trackId);
  if (!track) return;

  projectStore.updateTrack(trackId, { mute: !track.mute });
  pushHistory("Toggle mute");
  syncAudioPreview();
}

function toggleTrackVisible(trackId: string) {
  const track = tracks.value.find((item) => item.id === trackId);
  if (!track) return;

  projectStore.updateTrack(trackId, { visible: track.visible === false });
  pushHistory("Toggle visibility");
  syncAudioPreview();
  renderCharts();
}

function browseAudioFile() {
  if (!activeTrack.value) {
    showToast("Select a track first");
    return;
  }

  audioInput.value?.click();
}

function importAudioFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const track = activeTrack.value;

  if (!file || !track) return;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "wav" && extension !== "ogg") {
    showToast("Only wav and ogg files are supported");
    input.value = "";
    return;
  }

  const asset = projectStore.addAsset({
    fileName: file.name,
    originalPath: file.name,
    packagedPath: `Assets/${file.name}`,
    objectUrl: URL.createObjectURL(file),
    format: extension,
    size: file.size,
  });

  if (asset) {
    projectStore.setTrackAsset(track.id, asset.id);
    pushHistory("Assign audio file");
    showToast(`${file.name} assigned`);
  }

  input.value = "";
}

function updateSelectedPoint(axis: "speed" | "value", event: Event) {
  const selected = selectedKeyframe.value;
  if (!selected) return;

  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  projectStore.updateKeyframe(
    selected.trackId,
    selected.curveSet,
    selected.kind,
    selected.keyframeId,
    axis === "speed" ? { speed: value } : { value },
  );
  pushHistory("Update keyframe");
  renderCharts();
  syncAudioPreview();
}

function deleteSelectedPoint() {
  const selected = selectedKeyframe.value;
  if (!selected) return;

  projectStore.removeKeyframe(
    selected.trackId,
    selected.curveSet,
    selected.kind,
    selected.keyframeId,
  );
  editorStore.clearSelection();
  pushHistory("Delete keyframe");
  syncAudioPreview();
  renderCharts();
}

function exportReserved() {
  showToast("Export File is reserved");
}

function clearActiveSelection() {
  activateTrack(null);
}

function applyUndo() {
  const document = projectStore.document;
  if (!document) return;

  const snapshot = historyStore.undo(document, editorStore.runtime);
  if (!snapshot) return;

  projectStore.replaceDocument(snapshot.document);
  editorStore.replaceRuntime(snapshot.editor);
  syncAudioPreview();
  renderCharts();
}

function applyRedo() {
  const document = projectStore.document;
  if (!document) return;

  const snapshot = historyStore.redo(document, editorStore.runtime);
  if (!snapshot) return;

  projectStore.replaceDocument(snapshot.document);
  editorStore.replaceRuntime(snapshot.editor);
  syncAudioPreview();
  renderCharts();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement) return;

  if (event.code === "Space") {
    event.preventDefault();
    toggleTransport();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "d") {
    event.preventDefault();
    clearActiveSelection();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    applyUndo();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "y") {
    event.preventDefault();
    applyRedo();
    return;
  }

  if (event.key === "Delete") {
    deleteSelectedPoint();
  }
}

function goHome() {
  pauseTransport();
  emit("return-home");
}

async function minimizeWindow() {
  await getCurrentWindow().minimize();
}

async function toggleMaximizeWindow() {
  await getCurrentWindow().toggleMaximize();
}

async function closeWindow() {
  await getCurrentWindow().close();
}

watch(
  () => editorStore.simulator.currentSpeed,
  (speed) => {
    speedDraft.value = speed.toFixed(1);
  },
  { immediate: true },
);

watch(
  () => [projectStore.tracks, editorStore.runtime] as const,
  () => {
    if (isDraggingKeyframe) return;

    renderCharts();
    if (editorStore.playback.transport === "playing") {
      syncAudioPreview();
    }
  },
  { deep: true },
);

onMounted(() => {
  void nextTick(() => {
    if (pitchChartEl.value) createStage(pitchChartEl.value, pitchConfig);
    if (volumeChartEl.value) createStage(volumeChartEl.value, volumeConfig);
  });
  window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
  stopAnimationLoop();
  audioEngine.dispose();
  charts.forEach(({ stage }) => stage.destroy());
  charts.clear();
  resizeObservers.forEach((observer) => observer.disconnect());
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <main class="editor-shell">
    <header class="titlebar" data-tauri-drag-region>
      <div class="title-lockup">
        <h1>BVE5 Motor Assistance</h1>
        <span>{{ meta?.name ?? "Untitled" }}</span>
      </div>
      <div class="window-controls">
        <button type="button" aria-label="Minimize" @click.stop="minimizeWindow">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" /></svg>
        </button>
        <button type="button" aria-label="Maximize" @click.stop="toggleMaximizeWindow">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3h6v6H3z" /></svg>
        </button>
        <button type="button" aria-label="Close" @click.stop="closeWindow">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="m3 3 6 6M9 3 3 9" />
          </svg>
        </button>
      </div>
    </header>

    <aside class="editor-tools">
      <button
        class="tool-button"
        :class="{ active: editorStore.view.tool === 'select' }"
        type="button"
        @click="setTool('select')"
      >
        <img :src="iconSelect" class="toolbar-icon" alt="" aria-hidden="true" />
        <span>Select Mode</span>
      </button>
      <button
      class="tool-button"
      :class="{ active: editorStore.view.tool === 'move' }"
      type="button"
      :disabled="!activeTrack"
      @click="setTool('move')"
      >

      <img :src="iconMove" class="toolbar-icon" alt="" aria-hidden="true" />
      <span>Move Mode</span>
    </button>
    <button
    class="tool-button"
    :class="{ active: editorStore.view.tool === 'keyframe' }"
    type="button"
    :disabled="!activeTrack"
    @click="setTool('keyframe')"
    >
    <img :src="iconKeyframe" class="toolbar-icon" alt="" aria-hidden="true" />
        <span>Keyframe</span>
      </button>

      <div class="speed-readout">
        <span>Current Speed</span>
        <label>
          <input
            v-model="speedDraft"
            type="number"
            min="0"
            :max="editorStore.simulator.maxSpeed"
            step="0.1"
            @change="commitSpeed"
            @keydown.enter.prevent="commitSpeed"
          />
          <small>km/h</small>
        </label>
      </div>

      <div class="spacer" />

      <button class="tool-button" type="button" @click="exportReserved">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        <span>Export File</span>
      </button>
      <button class="tool-button" type="button" @click="goHome">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 6 4 12l6 6" />
          <path d="M5 12h15" />
        </svg>
        <span>Return Home</span>
      </button>
    </aside>

    <section class="chart-workspace">
      <div class="chart-panel"><div ref="pitchChartEl" class="chart-host" /></div>
      <div class="chart-panel"><div ref="volumeChartEl" class="chart-host" /></div>
    </section>

    <aside class="track-sidebar">
      <section class="panel track-layers">
        <header>
          <h2>Track Layers</h2>
          <div class="track-actions">
            <button type="button" aria-label="Add track" @click="addTrack">+</button>
            <button
              type="button"
              aria-label="Delete active track"
              :disabled="!activeTrack"
              @click="deleteActiveTrack"
            >
              -
            </button>
          </div>
        </header>

        <select
          class="active-select"
          :value="activeTrackId ?? ''"
          @change="activateTrack(($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">None</option>
          <option v-for="track in tracks" :key="track.id" :value="track.id">
            {{ track.name }}
          </option>
        </select>

        <div class="track-list">
          <div
            v-for="track in tracks"
            :key="track.id"
            class="track-row"
            :class="{
              active: track.id === activeTrackId,
              hidden: track.visible === false,
            }"
            role="button"
            tabindex="0"
            @click="toggleTrackActivation(track.id)"
            @keydown.enter="toggleTrackActivation(track.id)"
          >
            <span class="color-strip" :style="{ background: track.color }" />
            <span class="track-name">{{ track.name }}</span>
            <button
              type="button"
              class="icon-toggle"
              :aria-label="track.mute ? 'Unmute track' : 'Mute track'"
              @click.stop="toggleTrackMute(track.id)"
            >
              <img :src="track.mute ? iconMute : iconUnmute" alt="" />
            </button>
            <button
              type="button"
              class="icon-toggle"
              :class="{ active: track.visible !== false }"
              :aria-label="
                track.visible === false ? 'Show track' : 'Hide track'
              "
              @click.stop="toggleTrackVisible(track.id)"
            >
              <img
                :src="track.visible === false ? iconPreviewClose : iconPreviewOpen"
                alt=""
              />
            </button>
          </div>
        </div>
      </section>

      <section class="panel track-details">
        <h2>Track Details</h2>
        <template v-if="activeTrack">
          <label>
            <span>Name</span>
            <input :value="activeTrack.name" type="text" @change="updateTrackName" />
          </label>
          <label>
            <span>Color</span>
            <input
              class="color-input"
              :value="activeTrack.color"
              type="color"
              @input="updateTrackColor"
            />
          </label>
          <label>
            <span>File</span>
            <button class="file-picker" type="button" @click="browseAudioFile">
              <span>{{ activeAssetName }}</span>
              <img :src="iconOpenFile" alt="" aria-hidden="true" />
            </button>
          </label>

          <div class="divider" />

          <label>
            <span>X</span>
            <div class="unit-input">
              <input
                :value="selectedPoint?.speed.toFixed(2) ?? ''"
                type="number"
                min="0"
                :max="editorStore.simulator.maxSpeed"
                step="0.1"
                :disabled="!selectedPoint"
                @change="updateSelectedPoint('speed', $event)"
              />
              <small>km/h</small>
            </div>
          </label>
          <label>
            <span>Y</span>
            <input
              :value="selectedPoint?.value.toFixed(2) ?? ''"
              type="number"
              step="0.01"
              :disabled="!selectedPoint"
              @change="updateSelectedPoint('value', $event)"
            />
          </label>
          <button
            class="delete-button"
            type="button"
            :disabled="!selectedPoint"
            @click="deleteSelectedPoint"
          >
            Delete Selected Point
          </button>
        </template>
        <p v-else class="empty-details">No active track</p>
      </section>
    </aside>

    <footer class="transport-bar">
      <button class="play-button" type="button" @click="toggleTransport">
        <svg v-if="editorStore.playback.transport !== 'playing'" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg v-else viewBox="0 0 24 24">
          <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
        </svg>
      </button>

      <div class="mode-control">
        <button
          type="button"
          :class="{ active: editorStore.simulator.mode === 'traction' }"
          @click="setMode('traction')"
        >
          Traction
        </button>
        <button
          type="button"
          :class="{ active: editorStore.simulator.mode === 'coasting' }"
          @click="setMode('coasting')"
        >
          Coasting
        </button>
        <button
          type="button"
          :class="{ active: editorStore.simulator.mode === 'brake' }"
          @click="setMode('brake')"
        >
          Brake
        </button>
      </div>

      <label class="transport-field">
        <span>Max Speed</span>
        <input
          :value="editorStore.simulator.maxSpeed"
          type="number"
          min="1"
          step="1"
          @change="updateMaxSpeed"
        />
        <small>km/h</small>
      </label>

      <label class="transport-field">
        <span>Acceleration</span>
        <input
          :value="editorStore.simulator.acceleration"
          type="number"
          min="0"
          step="0.1"
          @change="updateAcceleration"
        />
        <small>m/s²</small>
      </label>

      <span class="mode-readout">{{ modeLabel }} · {{ activeCurveSet }}</span>
      <span class="version">v{{ APP_VERSION }}</span>
    </footer>

    <input
      ref="audioInput"
      class="file-input"
      type="file"
      accept=".wav,.ogg,audio/wav,audio/ogg"
      @change="importAudioFile"
    />
    <p v-if="toast" class="toast" role="status">{{ toast }}</p>
  </main>
</template>

<style scoped>
.editor-shell {
  position: relative;
  display: grid;
  grid-template-rows: var(--app-titlebar-height) 1fr var(--app-bottombar-height);
  grid-template-columns: 128px minmax(520px, 1fr) 253px;
  width: 100%;
  height: 100vh;
  min-width: 1040px;
  min-height: 660px;
  overflow: hidden;
  color: #f5f8fb;
  background: #29323a;
}

.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  grid-column: 1 / -1;
  height: var(--app-titlebar-height);
  padding: var(--app-titlebar-padding);
  background: var(--app-titlebar-bg);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
  user-select: none;
}

.title-lockup {
  display: flex;
  gap: 36px;
  align-items: baseline;
}

.title-lockup h1 {
  margin: 0;
  font-size: var(--app-titlebar-font-size);
  font-weight: 780;
  letter-spacing: 0;
}

.title-lockup span {
  font-size: 18px;
}

.title-lockup span,
.transport-field span,
.transport-field small,
.mode-readout {
  color: rgba(245, 248, 251, 0.68);
}

.window-controls {
  display: flex;
  gap: 16px;
  align-items: center;
}

.window-controls button,
.tool-button,
.panel header button,
.track-row,
.icon-toggle,
.mini-toggle,
.file-picker,
.delete-button,
.play-button,
.mode-control button {
  color: inherit;
  background: transparent;
  border: 0;
}

.window-controls button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 4px;
}

.window-controls button:hover,
.tool-button:hover:not(:disabled),
.tool-button.active {
  background: #354252;
}

.window-controls button:last-child:hover {
  background: #c54545;
}

.window-controls svg,
.tool-button svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.window-controls svg {
  width: 18px;
  height: 18px;
  stroke-width: 1.6;
}

.editor-tools {
  display: flex;
  flex-direction: column;
  grid-row: 2;
  grid-column: 1;
  background: #20262b;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.tool-button {
  position: relative;
  display: grid;
  height: 90px;
  gap: 8px;
  place-items: center;
  min-height: 78px;
  padding: 14px 6px;
}

.tool-button::before {
  position: absolute;
  top: 22px;
  bottom: 22px;
  left: 0;
  width: 4px;
  content: "";
  background: #5d86cb;
  opacity: 0;
}

.tool-button.active::before {
  opacity: 1;
}

.tool-button:disabled {
  cursor: default;
  opacity: 0.42;
}

.tool-button svg {
  width: 34px;
  height: 34px;
  stroke-width: 2;
}

.tool-button span:last-child {
  font-size: 15px;
  text-align: center;
}

.toolbar-icon {
  width: 36px;
  height: 36px;
}

.speed-readout {
  display: grid;
  gap: 8px;
  padding: 18px 8px;
  margin-top: 8px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.speed-readout label {
  display: flex;
  width: 112px;
  gap: 5px;
  align-items: baseline;
  justify-content: center;
  margin: 0 auto;
  white-space: nowrap;
}

.speed-readout input {
  flex: 0 0 72px;
  min-width: 0;
  color: #ffffff;
  font-size: 26px;
  font-weight: 760;
  text-align: right;
  background: transparent;
  border: 0;
  outline: none;
}

.speed-readout small {
  flex: 0 0 auto;
}

.spacer {
  flex: 1;
}

.chart-workspace {
  display: grid;
  grid-row: 2;
  grid-column: 2;
  grid-template-rows: 1fr 1fr;
  gap: 14px;
  min-width: 0;
  min-height: 0;
  padding-right: 10px;
  background: #354252;
}

.chart-panel {
  min-height: 0;
  overflow: hidden;
}

.chart-host {
  width: 100%;
  height: 100%;
}

.track-sidebar {
  display: grid;
  grid-row: 2;
  grid-column: 3;
  grid-template-rows: minmax(196px, 0.48fr) minmax(300px, 0.52fr);
  min-height: 0;
  background: #28333d;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
}

.panel {
  min-height: 0;
  padding: 14px 16px;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel h2 {
  margin: 0;
  font-size: 21px;
  font-weight: 500;
  letter-spacing: 1px;
}

.panel header button {
  width: 30px;
  height: 30px;
  padding: 0;
  font-size: 26px;
}

.panel header button:disabled {
  cursor: default;
  opacity: 0.35;
}

.track-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.active-select,
.track-details input,
.transport-field input {
  height: 30px;
  color: #ffffff;
  background: #172129;
  border: 0;
  border-radius: 4px;
  outline: none;
}

.active-select {
  width: 100%;
  padding: 0 10px;
  margin-bottom: 8px;
}

.track-list {
  display: grid;
  gap: 5px;
  max-height: calc(100% - 70px);
  overflow-y: auto;
}

.track-row {
  display: grid;
  grid-template-columns: 5px 1fr 24px 24px;
  gap: 7px;
  align-items: center;
  min-height: 32px;
  padding: 0 4px 0 0;
  background: rgba(17, 25, 31, 0.62);
  border-radius: 4px;
}

.track-row.active {
  background: rgba(74, 105, 127, 0.72);
}

.track-row.hidden .track-name {
  opacity: 0.52;
}

.color-strip {
  align-self: stretch;
  border-radius: 4px 0 0 4px;
}

.track-name {
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-toggle,
.mini-toggle {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 4px;
}

.icon-toggle:hover,
.mini-toggle:hover,
.icon-toggle.active,
.mini-toggle.active {
  background: rgba(255, 255, 255, 0.12);
}

.icon-toggle img {
  width: 17px;
  height: 17px;
}

.mini-toggle {
  font-size: 12px;
}

.track-details {
  display: grid;
  align-content: start;
  gap: 10px;
}

.track-details label {
  display: grid;
  grid-template-columns: 46px 1fr;
  gap: 8px;
  align-items: center;
}

.track-details input {
  width: 100%;
  padding: 0 10px;
}

.track-details input:disabled {
  color: rgba(255, 255, 255, 0.38);
}

.color-input {
  padding: 2px !important;
}

.file-picker {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  padding: 0 8px 0 10px;
  overflow: hidden;
  background: #172129;
  border-radius: 4px;
}

.file-picker span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-picker img {
  width: 22px;
  height: 22px;
}

.divider {
  height: 1px;
  margin: 10px 0;
  background: rgba(255, 255, 255, 0.08);
}

.unit-input {
  display: grid;
  grid-template-columns: 1fr 45px;
  gap: 6px;
  align-items: center;
}

.unit-input small {
  text-align: right;
}

.delete-button {
  height: 36px;
  margin-top: 10px;
  background: #1b2630;
  border-radius: 5px;
}

.delete-button:disabled {
  color: rgba(255, 255, 255, 0.36);
  cursor: default;
}

.empty-details {
  color: rgba(255, 255, 255, 0.58);
}

.transport-bar {
  position: relative;
  display: grid;
  grid-row: 3;
  grid-column: 1 / -1;
  grid-template-columns: 76px 300px auto auto 1fr;
  gap: 18px;
  align-items: center;
  height: var(--app-bottombar-height);
  min-width: 0;
  padding: 0 88px 0 38px;
  background: #293038;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.play-button {
  display: grid;
  place-items: center;
  width: 52px;
  height: 42px;
  padding: 0;
}

.play-button svg {
  width: 30px;
  height: 30px;
  fill: #ffffff;
}

.mode-control {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  overflow: hidden;
  background: #151d24;
  border-radius: 6px;
}

.mode-control button {
  height: 36px;
  padding: 0 14px;
}

.mode-control button.active {
  background: #34495b;
}

.transport-field {
  display: grid;
  grid-template-columns: auto 74px auto;
  gap: 9px;
  align-items: center;
  min-width: 190px;
}

.transport-field input {
  width: 74px;
  padding: 0 10px;
}

.mode-readout {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version {
  position: absolute;
  right: var(--app-version-right);
  bottom: var(--app-version-bottom);
  color: rgba(255, 255, 255, 0.44);
  font-size: 14px;
}

.file-input {
  display: none;
}

.toast {
  position: fixed;
  right: 18px;
  bottom: 68px;
  z-index: 50;
  margin: 0;
  padding: 10px 14px;
  color: #eef8fd;
  background: rgba(27, 39, 46, 0.94);
  border: 1px solid rgba(178, 213, 230, 0.16);
  border-radius: 7px;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.24);
}
</style>
