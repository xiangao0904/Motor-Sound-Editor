<script setup lang="ts">
import Konva from "konva";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createObjectUrl, fileNameFromPath } from "@/services/msepProject";
import { readAudioMetadataBatch } from "@/services/nativeInterop";
import StyledNumberInput from "@/components/StyledNumberInput.vue";
import { useAssetPayloadStore } from "@/stores/assetPayloads";
import { useEditorStore } from "@/stores/editor";
import { useHistoryStore } from "@/stores/history";
import { useProjectStore } from "@/stores/project";
import { useSettingsStore } from "@/stores/settings";
import { AudioPreviewEngine } from "@/services/audioPreview";
import { CURVE_MAX_VALUE, CURVE_MIN_VALUE } from "@/constants/curveRanges";
import { sampleCurve } from "@/utils/curves";
import { APP_VERSION } from "@/types/project";
import type {
  CurveKind,
  CurveSetKind,
  Keyframe,
  Track,
  TrackCurve,
  TrackCurveSet,
} from "@/types/track";

import iconMute from "@/assets/icons/mute.png";
import iconOpenFile from "@/assets/icons/openfile.png";
import iconUnmute from "@/assets/icons/unmute.png";
import iconSelect from "@/assets/icons/select.png";
import iconMove from "@/assets/icons/move.png";
import iconKeyframe from "@/assets/icons/keyframe.png";
import iconPreviewOpen from "@/assets/icons/preview-open.png";
import iconPreviewClose from "@/assets/icons/preview-close.png";

const emit = defineEmits<{
  "return-home": [];
  "save-project": [];
  "export-project": [];
}>();

interface ChartConfig {
  kind: CurveKind;
  label: string;
  unit: string;
  maxValue: number;
}

interface ChartRuntime {
  stage: Konva.Stage;
  backgroundLayer: Konva.Layer;
  curveLayer: Konva.Layer;
  interactionLayer: Konva.Layer;
  playhead: Konva.Line | null;
  hoverHint: Konva.Text | null;
  config: ChartConfig;
}

type CurveSetDraft = Record<CurveSetKind, TrackCurveSet>;

interface ChartContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  chartKind: CurveKind | null;
  speed: number;
  value: number;
}

interface ListContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  curveSet: CurveSetKind | null;
  kind: CurveKind | null;
  index: number | null;
}

const projectStore = useProjectStore();
const assetPayloadStore = useAssetPayloadStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();
const settingsStore = useSettingsStore();
const audioEngine = new AudioPreviewEngine();

const pitchChartEl = ref<HTMLDivElement | null>(null);
const volumeChartEl = ref<HTMLDivElement | null>(null);
const speedDraft = ref("0.0");
const toast = ref("");
const chartContextMenu = reactive<ChartContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  chartKind: null,
  speed: 0,
  value: 0,
});
const isListEditorOpen = ref(false);
const isProjectDetailsOpen = ref(false);
const listDraft = ref<CurveSetDraft | null>(null);
const listEditorTrackId = ref<string | null>(null);
const projectNameDraft = ref("");
const listContextMenu = reactive<ListContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  curveSet: null,
  kind: null,
  index: null,
});
const addKeyframePanel = reactive({
  visible: false,
  x: 0,
  y: 0,
  curveSet: "traction" as CurveSetKind,
  kind: "volume" as CurveKind,
  speed: "0",
  value: "0",
});

const charts = new Map<CurveKind, ChartRuntime>();
const resizeObservers: ResizeObserver[] = [];
let animationFrame: number | null = null;
let audioPreviewSyncFrame: number | null = null;
let lastFrameTime = 0;
let isPreparingKeyframeDrag = false;
let isDraggingKeyframe = false;
let suppressNextChartClick = false;
let draggingCircle: Konva.Circle | null = null;

const pitchConfig: ChartConfig = {
  kind: "pitch",
  label: "Pitch",
  unit: "Hz",
  maxValue: CURVE_MAX_VALUE.pitch,
};
const volumeConfig: ChartConfig = {
  kind: "volume",
  label: "Volume",
  unit: "dB",
  maxValue: CURVE_MAX_VALUE.volume,
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
  const track = selected ? projectStore.trackById.get(selected.trackId) : null;

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

  return projectStore.assetById.get(track.assetId)?.fileName ?? "No file";
});

const modeLabel = computed(() => {
  const mode = editorStore.simulator.mode;
  if (mode === "traction") return "Traction";
  if (mode === "brake") return "Brake";
  return "Coasting";
});

const listEditorTrack = computed(() => {
  const trackId = listEditorTrackId.value;
  return trackId ? projectStore.trackById.get(trackId) ?? null : null;
});

const listRows = computed(() => {
  const draft = listDraft.value;
  if (!draft) return [];

  const rowCount = Math.max(
    draft.traction.volume.keyframes.length,
    draft.traction.pitch.keyframes.length,
    draft.brake.volume.keyframes.length,
    draft.brake.pitch.keyframes.length,
    1,
  );

  return Array.from({ length: rowCount }, (_, index) => index);
});

const canDeleteListContextKeyframe = computed(() => {
  const { curveSet, kind, index } = listContextMenu;
  if (!curveSet || !kind || index === null) return false;

  return getDraftKeyframe(curveSet, kind, index) !== null;
});

const listSyncLabel = computed(() =>
  listContextMenu.curveSet === "brake"
    ? "Sync brake to traction"
    : "Sync traction to brake",
);
const projectStats = computed(() => {
  const document = projectStore.document;
  if (!document) return null;

  const keyframeCount = document.tracks.tracks.reduce((total, track) => {
    const curveSets = Object.values(track.curveSets);
    return (
      total +
      curveSets.reduce(
        (curveSetTotal, curveSet) =>
          curveSetTotal +
          curveSet.pitch.keyframes.length +
          curveSet.volume.keyframes.length,
        0,
      )
    );
  }, 0);

  return {
    filePath: projectStore.currentFilePath ?? "Unsaved project",
    trackCount: document.tracks.tracks.length,
    assetCount: document.tracks.assets.length,
    assignedAudioCount: document.tracks.tracks.filter((track) => track.assetId)
      .length,
    keyframeCount,
    maxSpeed: document.project.meta.maxSpeed,
    acceleration: document.project.meta.acceleration,
    brakeDeceleration: document.project.meta.brakeDeceleration,
    createdAt: document.project.meta.createdAt,
    updatedAt: document.project.meta.updatedAt,
  };
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

function roundToTwo(value: number) {
  return Number(value.toFixed(2));
}

function snapToStep(value: number, step: number) {
  return Number(
    (Math.round(value / step) * step).toFixed(10),
  );
}

function isShiftPressed(event: Event) {
  return "shiftKey" in event && event.shiftKey === true;
}

function normalizeChartPoint(
  config: ChartConfig,
  point: { speed: number; value: number },
  shouldSnap: boolean,
) {
  const speed = shouldSnap
    ? snapToStep(point.speed, settingsStore.keyframeSnap.speedStep)
    : point.speed;
  const value = shouldSnap
    ? snapToStep(point.value, settingsStore.keyframeSnap.valueStep)
    : point.value;

  return {
    speed: clamp(speed, 0, editorStore.simulator.maxSpeed),
    value: clamp(value, CURVE_MIN_VALUE[config.kind], config.maxValue),
  };
}

function formatTwoDecimals(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2)
    : "";
}

function formatProjectDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function sortedKeyframes(curve: TrackCurve): Keyframe[] {
  return curve.keyframes;
}

function syncAudioPreview() {
  audioEngine.update(
    tracks.value,
    activeCurveSet.value,
    editorStore.simulator.currentSpeed,
  );
}

function queueAudioPreviewSync() {
  if (audioPreviewSyncFrame !== null) return;

  audioPreviewSyncFrame = requestAnimationFrame(() => {
    audioPreviewSyncFrame = null;
    syncAudioPreview();
  });
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

function canvasToPoint(
  stage: Konva.Stage,
  config: ChartConfig,
  x: number,
  y: number,
) {
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

function curvePoints(
  stage: Konva.Stage,
  config: ChartConfig,
  curve: TrackCurve,
) {
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
  runtime.stage.container().style.cursor =
    editorStore.view.tool === "keyframe" && activeTrack.value
      ? "crosshair"
      : "default";
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
  const backgroundLayer = new Konva.Layer({ listening: false });
  const curveLayer = new Konva.Layer();
  const interactionLayer = new Konva.Layer({ listening: false });
  stage.add(backgroundLayer);
  stage.add(curveLayer);
  stage.add(interactionLayer);

  const runtime = {
    stage,
    backgroundLayer,
    curveLayer,
    interactionLayer,
    playhead: null,
    hoverHint: null,
    config,
  };
  charts.set(config.kind, runtime);

  stage.on("click tap", (event) => handleChartClick(runtime, event.evt));
  stage.on("mouseleave", () => {
    editorStore.hoverKeyframe(null);
    setStageCursor(runtime);
  });
  stage.on("contextmenu", (event) => {
    event.evt.preventDefault();
    handleChartContextMenu(runtime, event);
  });

  const observer = new ResizeObserver(() => resizeStage(runtime, container));
  observer.observe(container);
  resizeObservers.push(observer);
  renderChart(runtime);
}

function stopCurrentKeyframeDrag() {
  if (!draggingCircle && !isDraggingKeyframe && !isPreparingKeyframeDrag) return;

  const circle = draggingCircle;
  draggingCircle = null;

  if (circle?.isDragging()) {
    circle.stopDrag();
  }

  isPreparingKeyframeDrag = false;
  isDraggingKeyframe = false;
  suppressNextChartClick = false;
  charts.forEach((runtime) => {
    hideKeyframeHoverHint(runtime);
    setStageCursor(runtime);
  });
}

function isSameSelectedKeyframe(
  runtime: ChartRuntime,
  trackId: string,
  keyframeId: string,
) {
  const selected = selectedKeyframe.value;
  if (!selected) return false;
  return (
    selected.trackId === trackId &&
    selected.curveSet === activeCurveSet.value &&
    selected.kind === runtime.config.kind &&
    selected.keyframeId === keyframeId
  );
}

function isMoveableSelectedKeyframe(
  runtime: ChartRuntime,
  track: Track,
  keyframeId: string,
) {
  return (
    editorStore.view.tool === "move" &&
    isEditableTrack(track) &&
    track.locked !== true &&
    isSameSelectedKeyframe(runtime, track.id, keyframeId)
  );
}

function stepMode(direction: "up" | "down") {
  const mode = editorStore.simulator.mode;

  if (direction === "up") {
    if (mode === "brake") {
      setMode("coasting");
      return;
    }
    if (mode === "coasting") {
      setMode("traction");
    }
    return;
  }

  if (mode === "traction") {
    setMode("coasting");
    return;
  }
  if (mode === "coasting") {
    setMode("brake");
  }
}

function closeChartContextMenu() {
  chartContextMenu.visible = false;
}

function closeListContextMenu() {
  listContextMenu.visible = false;
}

function closeAddKeyframePanel() {
  addKeyframePanel.visible = false;
}

function closeTransientMenus() {
  closeChartContextMenu();
  closeListContextMenu();
  closeAddKeyframePanel();
}

function openProjectDetails() {
  projectNameDraft.value = meta.value?.name ?? "Untitled Project";
  closeTransientMenus();
  isProjectDetailsOpen.value = true;
}

function cancelProjectDetails() {
  isProjectDetailsOpen.value = false;
  projectNameDraft.value = "";
}

function saveProjectDetails() {
  const currentName = meta.value?.name ?? "";
  const nextName = projectNameDraft.value.trim() || "Untitled Project";

  if (nextName !== currentName) {
    projectStore.setProjectMeta({ name: nextName });
    pushHistory("Update project details");
    showToast("Project details saved");
  }

  isProjectDetailsOpen.value = false;
}

function addKeyframeAtChartPoint(
  runtime: ChartRuntime,
  speed: number,
  value: number,
  shouldSnap = false,
) {
  const active = activeTrack.value;
  if (!active || active.visible === false) return null;

  const point = normalizeChartPoint(
    runtime.config,
    { speed, value },
    shouldSnap,
  );
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
    queueAudioPreviewSync();
    renderCurveCharts();
  }

  return keyframe;
}

function cloneDraftCurve(curve: TrackCurve): TrackCurve {
  return {
    kind: curve.kind,
    interpolation: curve.interpolation,
    keyframes: curve.keyframes.map((keyframe) => ({
      ...keyframe,
      speed: roundToTwo(keyframe.speed),
      value: roundToTwo(keyframe.value),
    })),
  };
}

function cloneDraftCurveSet(curveSet: TrackCurveSet): TrackCurveSet {
  return {
    pitch: cloneDraftCurve(curveSet.pitch),
    volume: cloneDraftCurve(curveSet.volume),
  };
}

function createListDraft(track: Track): CurveSetDraft {
  return {
    traction: cloneDraftCurveSet(track.curveSets.traction),
    brake: cloneDraftCurveSet(track.curveSets.brake),
  };
}

function getDraftKeyframe(
  curveSet: CurveSetKind,
  kind: CurveKind,
  index: number,
) {
  return listDraft.value?.[curveSet][kind].keyframes[index] ?? null;
}

function sortDraftKeyframes(curveSet: CurveSetKind, kind: CurveKind) {
  const curve = listDraft.value?.[curveSet][kind];
  if (!curve) return;

  curve.keyframes = [...curve.keyframes].sort((a, b) => a.speed - b.speed);
}

function normalizeDraftSpeed(value: number) {
  return roundToTwo(clamp(value, 0, editorStore.simulator.maxSpeed));
}

function normalizeDraftValue(kind: CurveKind, value: number) {
  return roundToTwo(
    clamp(value, CURVE_MIN_VALUE[kind], CURVE_MAX_VALUE[kind]),
  );
}

function updateListCell(
  curveSet: CurveSetKind,
  kind: CurveKind,
  index: number,
  field: "speed" | "value",
  value: number,
) {
  const keyframe = getDraftKeyframe(curveSet, kind, index);
  if (!keyframe) return;

  if (!Number.isFinite(value)) return;

  if (field === "speed") {
    keyframe.speed = normalizeDraftSpeed(value);
    sortDraftKeyframes(curveSet, kind);
  } else {
    keyframe.value = normalizeDraftValue(kind, value);
  }
}

function openListEditor() {
  const track = activeTrack.value;
  if (!track) {
    showToast("Select a track first");
    return;
  }

  listEditorTrackId.value = track.id;
  listDraft.value = createListDraft(track);
  closeTransientMenus();
  isListEditorOpen.value = true;
}

function cancelListEditor() {
  isListEditorOpen.value = false;
  listDraft.value = null;
  listEditorTrackId.value = null;
  closeTransientMenus();
}

function applyListEditor() {
  if (!listDraft.value || !listEditorTrackId.value) return;

  projectStore.replaceTrackCurveSets(listEditorTrackId.value, listDraft.value);
  editorStore.clearSelection();
  pushHistory("Apply list editor");
  isListEditorOpen.value = false;
  listDraft.value = null;
  listEditorTrackId.value = null;
  closeTransientMenus();
  queueAudioPreviewSync();
  renderCurveCharts();
}

function openListContextMenu(
  event: MouseEvent,
  curveSet: CurveSetKind,
  kind: CurveKind | null = null,
  index: number | null = null,
) {
  event.preventDefault();
  event.stopPropagation();
  closeChartContextMenu();
  closeAddKeyframePanel();
  listContextMenu.visible = true;
  listContextMenu.x = Math.min(event.clientX, window.innerWidth - 220);
  listContextMenu.y = Math.min(event.clientY, window.innerHeight - 132);
  listContextMenu.curveSet = curveSet;
  listContextMenu.kind = kind;
  listContextMenu.index = index;
}

function syncDraftCurveSets(source: CurveSetKind, target: CurveSetKind) {
  const draft = listDraft.value;
  if (!draft) return;

  draft[target] = {
    pitch: {
      ...draft[source].pitch,
      keyframes: draft[source].pitch.keyframes.map((keyframe) => ({
        ...keyframe,
        id: crypto.randomUUID(),
        speed: roundToTwo(keyframe.speed),
        value: roundToTwo(keyframe.value),
      })),
    },
    volume: {
      ...draft[source].volume,
      keyframes: draft[source].volume.keyframes.map((keyframe) => ({
        ...keyframe,
        id: crypto.randomUUID(),
        speed: roundToTwo(keyframe.speed),
        value: roundToTwo(keyframe.value),
      })),
    },
  };
  closeListContextMenu();
}

function runListContextSync() {
  if (listContextMenu.curveSet === "brake") {
    syncDraftCurveSets("brake", "traction");
  } else {
    syncDraftCurveSets("traction", "brake");
  }
}

function openListAddKeyframePanel() {
  if (!listContextMenu.curveSet) return;

  addKeyframePanel.visible = true;
  addKeyframePanel.x = Math.min(listContextMenu.x + 16, window.innerWidth - 260);
  addKeyframePanel.y = Math.min(listContextMenu.y + 36, window.innerHeight - 218);
  addKeyframePanel.curveSet = listContextMenu.curveSet;
  addKeyframePanel.kind = listContextMenu.kind ?? "volume";
  addKeyframePanel.speed = "0.00";
  addKeyframePanel.value = addKeyframePanel.kind === "pitch" ? "1.00" : "0.00";
  closeListContextMenu();
}

function confirmListAddKeyframe() {
  const draft = listDraft.value;
  if (!draft) return;

  const speed = Number(addKeyframePanel.speed);
  const value = Number(addKeyframePanel.value);
  if (!Number.isFinite(speed) || !Number.isFinite(value)) return;

  draft[addKeyframePanel.curveSet][addKeyframePanel.kind].keyframes.push({
    id: crypto.randomUUID(),
    speed: normalizeDraftSpeed(speed),
    value: normalizeDraftValue(addKeyframePanel.kind, value),
  });
  sortDraftKeyframes(addKeyframePanel.curveSet, addKeyframePanel.kind);
  closeAddKeyframePanel();
}

function removeListContextKeyframe() {
  const draft = listDraft.value;
  const { curveSet, kind, index } = listContextMenu;
  if (!draft || !curveSet || !kind || index === null) return;

  const keyframe = getDraftKeyframe(curveSet, kind, index);
  if (!keyframe) return;

  draft[curveSet][kind].keyframes.splice(index, 1);
  closeListContextMenu();
}

function runChartContextAddKeyframe() {
  const runtime = chartContextMenu.chartKind
    ? charts.get(chartContextMenu.chartKind)
    : null;
  if (!runtime) return;

  addKeyframeAtChartPoint(
    runtime,
    chartContextMenu.speed,
    chartContextMenu.value,
  );
  closeChartContextMenu();
}

function handleChartClick(runtime: ChartRuntime, event: Event) {
  closeTransientMenus();

  if (suppressNextChartClick) {
    suppressNextChartClick = false;
    return;
  }

  const pointer = runtime.stage.getPointerPosition();
  if (!pointer || isDraggingKeyframe) return;

  const target = runtime.stage.getIntersection(pointer);
  const trackId = target?.attrs.trackId as string | undefined;
  const keyframeId = target?.attrs.keyframeId as string | undefined;
  const active = activeTrack.value;

  if (editorStore.view.tool === "select") {
    if (trackId && (!active || active.id === trackId)) {
      const shouldClearSelectedKeyframe =
        keyframeId && isSameSelectedKeyframe(runtime, trackId, keyframeId);

      activateTrack(trackId);

      if (keyframeId) {
        if (shouldClearSelectedKeyframe) {
          editorStore.selectKeyframe(null);
        } else {
          editorStore.selectKeyframe({
            trackId,
            curveSet: activeCurveSet.value,
            kind: runtime.config.kind,
            keyframeId,
          });
        }
      }

      renderCurveCharts();
      return;
    }

    const point = canvasToPoint(
      runtime.stage,
      runtime.config,
      pointer.x,
      pointer.y,
    );
    editorStore.setCurrentSpeed(point.speed);
    queueAudioPreviewSync();
    renderPlayheads();
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
    renderCurveCharts();
    return;
  }

  if (editorStore.view.tool !== "keyframe") return;

  const point = canvasToPoint(
    runtime.stage,
    runtime.config,
    pointer.x,
    pointer.y,
  );
  addKeyframeAtChartPoint(
    runtime,
    point.speed,
    point.value,
    isShiftPressed(event),
  );
}

function handleChartContextMenu(
  runtime: ChartRuntime,
  event: { target: Konva.Node; evt: MouseEvent },
) {
  const active = activeTrack.value;
  const target = event.target;
  const trackId = target.attrs.trackId as string | undefined;
  const keyframeId = target.attrs.keyframeId as string | undefined;

  if (
    editorStore.view.tool === "keyframe" &&
    active &&
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
    queueAudioPreviewSync();
    renderCurveCharts();
    return;
  }

  const pointer = runtime.stage.getPointerPosition();
  const point = pointer
    ? canvasToPoint(runtime.stage, runtime.config, pointer.x, pointer.y)
    : { speed: editorStore.simulator.currentSpeed, value: 0 };
  const menuPoint = normalizeChartPoint(
    runtime.config,
    point,
    isShiftPressed(event.evt),
  );

  closeListContextMenu();
  closeAddKeyframePanel();
  chartContextMenu.visible = true;
  chartContextMenu.x = Math.min(event.evt.clientX, window.innerWidth - 220);
  chartContextMenu.y = Math.min(event.evt.clientY, window.innerHeight - 96);
  chartContextMenu.chartKind = runtime.config.kind;
  chartContextMenu.speed = menuPoint.speed;
  chartContextMenu.value = menuPoint.value;
}

function renderCharts() {
  renderAllCharts();
}

function renderAllCharts() {
  charts.forEach((runtime) => renderChart(runtime));
}

function renderCurveCharts() {
  charts.forEach((runtime) => {
    renderCurveChart(runtime);
    renderPlayhead(runtime);
  });
}

function renderPlayheads() {
  charts.forEach((runtime) => renderPlayhead(runtime));
}

function renderChart(runtime: ChartRuntime) {
  renderBackgroundChart(runtime);
  renderCurveChart(runtime);
  renderPlayhead(runtime);
}

function renderBackgroundChart(runtime: ChartRuntime) {
  const { stage, backgroundLayer, config } = runtime;
  const bounds = chartBounds(stage);
  const maxSpeed = editorStore.simulator.maxSpeed || 1;

  backgroundLayer.destroyChildren();
  backgroundLayer.add(
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
    backgroundLayer.add(
      new Konva.Line({
        points: [x, bounds.top, x, bounds.bottom],
        stroke: "rgba(189, 208, 219, 0.42)",
        strokeWidth: 1,
      }),
    );
    backgroundLayer.add(
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
    backgroundLayer.add(
      new Konva.Line({
        points: [bounds.left, y, bounds.right, y],
        stroke: "rgba(189, 208, 219, 0.42)",
        strokeWidth: 1,
      }),
    );
    backgroundLayer.add(
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

  backgroundLayer.add(
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
  backgroundLayer.add(
    new Konva.Text({
      x: 4,
      y: (bounds.top + bounds.bottom) / 2 + 42,
      text: `${config.label} (${config.unit})`,
      fontSize: 13,
      fill: "#F3F7FA",
      rotation: -90,
    }),
  );

  backgroundLayer.draw();
}

function showKeyframeHoverHint(runtime: ChartRuntime, x: number, y: number) {
  if (!runtime.hoverHint) {
    runtime.hoverHint = new Konva.Text({
      text: "-",
      fontSize: 18,
      fontStyle: "bold",
      fill: "#FFE796",
      listening: false,
    });
    runtime.interactionLayer.add(runtime.hoverHint);
  }

  runtime.hoverHint.position({ x: x + 10, y: y - 23 });
  runtime.hoverHint.show();
  runtime.interactionLayer.batchDraw();
}

function hideKeyframeHoverHint(runtime: ChartRuntime) {
  if (!runtime.hoverHint) return;

  runtime.hoverHint.hide();
  runtime.interactionLayer.batchDraw();
}

function renderCurveChart(runtime: ChartRuntime) {
  const { stage, curveLayer, config } = runtime;
  const bounds = chartBounds(stage);
  const hasActiveTrack = activeTrackId.value !== null;

  curveLayer.destroyChildren();
  hideKeyframeHoverHint(runtime);
  setStageCursor(runtime);

  tracks.value.filter(isVisibleTrack).forEach((track) => {
    const curve = track.curveSets[activeCurveSet.value][config.kind];
    const keyframes = sortedKeyframes(curve);
    const points = curvePoints(stage, config, curve);
    const editable = isEditableTrack(track);
    const dimmed = hasActiveTrack && !editable;
    const opacity = dimmed ? 0.3 : 1;
    const selectable =
      editorStore.view.tool === "select" && (!hasActiveTrack || editable);

    let line: Konva.Line | null = null;
    if (points.length >= 4) {
      line = new Konva.Line({
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

      curveLayer.add(line);
    }

    keyframes.forEach((keyframe) => {
      const initialSpeed = keyframe.speed;
      const initialValue = keyframe.value;
      const point = pointToCanvas(
        stage,
        config,
        keyframe.speed,
        keyframe.value,
      );
      const isSelected = editable && isSameSelectedKeyframe(runtime, track.id, keyframe.id);
      const canStartMove =
        editorStore.view.tool === "move" && editable && track.locked !== true;
      const keyframeSelectable =
        selectable ||
        canStartMove ||
        editorStore.view.tool === "keyframe";
      const circle = new Konva.Circle({
        x: point.x,
        y: point.y,
        radius: isSelected ? 7 : 5,
        fill: isSelected ? "#FF5A5A" : track.color,
        stroke: "#FFFFFF",
        strokeWidth: isSelected ? 2 : 0,
        opacity,
        listening: keyframeSelectable && (!hasActiveTrack || editable),
        draggable: canStartMove,
        dragBoundFunc: (position) => ({
          x: clamp(position.x, bounds.left, bounds.right),
          y: clamp(position.y, bounds.top, bounds.bottom),
        }),
        keyframeId: keyframe.id,
        trackId: track.id,
        curveKind: config.kind,
      });

      circle.on("mouseenter", () => {
        if (editorStore.view.tool === "select" && selectable) {
          runtime.stage.container().style.cursor = "pointer";
        } else if (canStartMove) {
          runtime.stage.container().style.cursor = "move";
        } else if (editorStore.view.tool === "keyframe" && editable) {
          runtime.stage.container().style.cursor = "pointer";
          showKeyframeHoverHint(runtime, circle.x(), circle.y());
        }

        editorStore.hoverKeyframe({
          trackId: track.id,
          curveSet: activeCurveSet.value,
          kind: config.kind,
          keyframeId: keyframe.id,
        });
      });
      circle.on("mouseleave", () => {
        hideKeyframeHoverHint(runtime);
        setStageCursor(runtime);
        editorStore.hoverKeyframe(null);
      });
      circle.on("mousedown touchstart", () => {
        if (!canStartMove) return;

        isPreparingKeyframeDrag = true;
        editorStore.selectKeyframe({
          trackId: track.id,
          curveSet: activeCurveSet.value,
          kind: config.kind,
          keyframeId: keyframe.id,
        });
        runtime.stage.container().style.cursor = "move";
      });
      circle.on("dragstart", () => {
        isPreparingKeyframeDrag = false;
        if (!isMoveableSelectedKeyframe(runtime, track, keyframe.id)) {
          circle.stopDrag();
          return;
        }

        isDraggingKeyframe = true;
        draggingCircle = circle;
        editorStore.selectKeyframe({
          trackId: track.id,
          curveSet: activeCurveSet.value,
          kind: config.kind,
          keyframeId: keyframe.id,
        });
        runtime.stage.container().style.cursor = "move";
      });
      circle.on("dragmove", (event) => {
        if (!isMoveableSelectedKeyframe(runtime, track, keyframe.id)) return;

        const position = circle.position();
        const movedPoint = normalizeChartPoint(
          config,
          canvasToPoint(stage, config, position.x, position.y),
          isShiftPressed(event.evt),
        );
        if (isShiftPressed(event.evt)) {
          circle.position(
            pointToCanvas(stage, config, movedPoint.speed, movedPoint.value),
          );
        }
        projectStore.moveKeyframeDraft(
          track.id,
          activeCurveSet.value,
          config.kind,
          keyframe.id,
          { speed: movedPoint.speed, value: movedPoint.value },
        );

        const currentTrack = projectStore.trackById.get(track.id);
        const currentCurve =
          currentTrack?.curveSets[activeCurveSet.value]?.[config.kind];
        if (line && currentCurve) {
          line.points(curvePoints(stage, config, currentCurve));
        }

        queueAudioPreviewSync();
        curveLayer.batchDraw();
      });
      circle.on("dragend", (event) => {
        try {
          const currentTrack = projectStore.trackById.get(track.id);
          const currentCurve =
            currentTrack?.curveSets[activeCurveSet.value]?.[config.kind];
          const currentKeyframe = currentCurve?.keyframes.find(
            (item) => item.id === keyframe.id,
          );

          if (currentTrack && currentCurve && currentKeyframe) {
            const position = circle.position();
            const finalPoint = normalizeChartPoint(
              config,
              canvasToPoint(stage, config, position.x, position.y),
              isShiftPressed(event.evt),
            );
            const changed =
              Math.abs(finalPoint.speed - initialSpeed) > 0.0001 ||
              Math.abs(finalPoint.value - initialValue) > 0.0001;

            projectStore.updateKeyframe(
              track.id,
              activeCurveSet.value,
              config.kind,
              keyframe.id,
              { speed: finalPoint.speed, value: finalPoint.value },
            );
            editorStore.selectKeyframe({
              trackId: track.id,
              curveSet: activeCurveSet.value,
              kind: config.kind,
              keyframeId: keyframe.id,
            });
            if (changed) {
              pushHistory("Move keyframe");
            }
          }
        } finally {
          isPreparingKeyframeDrag = false;
          isDraggingKeyframe = false;
          draggingCircle = null;
          suppressNextChartClick = true;
          window.setTimeout(() => {
            suppressNextChartClick = false;
          }, 0);
          queueAudioPreviewSync();
          setStageCursor(runtime);
          renderCurveCharts();
        }
      });

      curveLayer.add(circle);
    });
  });

  curveLayer.draw();
}

function renderPlayhead(runtime: ChartRuntime) {
  const { stage, config, interactionLayer } = runtime;
  const bounds = chartBounds(stage);
  const playhead = pointToCanvas(
    stage,
    config,
    editorStore.simulator.currentSpeed,
    0,
  );

  if (!runtime.playhead) {
    runtime.playhead = new Konva.Line({
      points: [playhead.x, bounds.top, playhead.x, bounds.bottom],
      stroke: "#F25B5B",
      strokeWidth: 2,
      dash: [6, 5],
      listening: false,
    });
    interactionLayer.add(runtime.playhead);
  } else {
    runtime.playhead.points([playhead.x, bounds.top, playhead.x, bounds.bottom]);
  }

  interactionLayer.batchDraw();
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
  queueAudioPreviewSync();
  if (!isDraggingKeyframe) {
    renderPlayheads();
  }

  if (hitLimit) {
    pauseTransport();
    return;
  }

  animationFrame = requestAnimationFrame(tick);
}

function setMode(mode: "traction" | "coasting" | "brake") {
  editorStore.setSimulatorMode(mode);
  renderCurveCharts();
  queueAudioPreviewSync();
}

function setTool(tool: "select" | "move" | "keyframe") {
  if (tool !== "select" && !activeTrack.value) {
    showToast("Select a track first");
    return;
  }

  stopCurrentKeyframeDrag();
  editorStore.setTool(tool);
  renderCurveCharts();
}

function commitSpeed(value: number) {
  editorStore.setCurrentSpeed(value);
  speedDraft.value = editorStore.simulator.currentSpeed.toFixed(1);
  queueAudioPreviewSync();
  renderPlayheads();
}

function updateMaxSpeed(value: number) {
  projectStore.setProjectMeta({ maxSpeed: value });
  editorStore.setMaxSpeed(value);
  pushHistory("Update max speed");
  renderCharts();
}

function updateAcceleration(value: number) {
  projectStore.setProjectMeta({
    acceleration: value,
    brakeDeceleration: value,
  });
  editorStore.setAcceleration(value);
  editorStore.setBrakeDeceleration(value);
  pushHistory("Update acceleration");
}

function activateTrack(trackId: string | null) {
  stopCurrentKeyframeDrag();
  projectStore.setActiveTrack(trackId);
  editorStore.setActiveTrackId(trackId);

  if (!trackId) {
    editorStore.setTool("select");
  }

  queueAudioPreviewSync();
  renderCurveCharts();
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

  const activeIndex = tracks.value.findIndex((item) => item.id === track.id);
  projectStore.removeTrack(track.id);
  const remainingTracks = tracks.value;
  const nextTrack =
    remainingTracks[Math.max(0, activeIndex - 1)] ??
    remainingTracks[activeIndex] ??
    null;

  activateTrack(nextTrack?.id ?? null);
  pushHistory("Delete track");
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
  renderCurveCharts();
}

function toggleTrackMute(trackId: string) {
  const track = projectStore.trackById.get(trackId);
  if (!track) return;

  projectStore.updateTrack(trackId, { mute: !track.mute });
  pushHistory("Toggle mute");
  queueAudioPreviewSync();
}

function toggleTrackVisible(trackId: string) {
  const track = projectStore.trackById.get(trackId);
  if (!track) return;

  projectStore.updateTrack(trackId, { visible: track.visible === false });
  pushHistory("Toggle visibility");
  queueAudioPreviewSync();
  renderCurveCharts();
}

async function browseAudioFile() {
  const track = activeTrack.value;
  if (!track) {
    showToast("Select a track first");
    return;
  }

  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Audio", extensions: ["wav", "ogg"] }],
  });

  if (typeof selected !== "string") return;

  const fileName = fileNameFromPath(selected);
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension !== "wav" && extension !== "ogg") {
    showToast("Only wav and ogg files are supported");
    return;
  }

  let bytes: Uint8Array;
  try {
    bytes = await readFile(selected);
  } catch {
    showToast("Audio file could not be read");
    return;
  }

  const [metadata] = await readAudioMetadataBatch([{ path: selected }]);
  const objectUrl = createObjectUrl(bytes, { format: extension });
  const asset = projectStore.addAsset({
    fileName,
    originalPath: selected,
    packagedPath: `Assets/${crypto.randomUUID()}-${fileName}`,
    objectUrl,
    format: extension,
    size: bytes.byteLength,
    durationSec: metadata?.durationSec,
    sampleRate: metadata?.sampleRate,
    channels: metadata?.channels,
  });

  if (asset) {
    assetPayloadStore.setPayload(asset.id, bytes);
    projectStore.setTrackAsset(track.id, asset.id);
    pushHistory("Assign audio file");
    showToast(`${fileName} assigned`);
  } else {
    URL.revokeObjectURL(objectUrl);
  }
}

function updateSelectedPoint(axis: "speed" | "value", value: number) {
  const selected = selectedKeyframe.value;
  if (!selected) return;

  projectStore.updateKeyframe(
    selected.trackId,
    selected.curveSet,
    selected.kind,
    selected.keyframeId,
    axis === "speed" ? { speed: value } : { value },
  );
  pushHistory("Update keyframe");
  renderCurveCharts();
  queueAudioPreviewSync();
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
  queueAudioPreviewSync();
  renderCurveCharts();
}

function exportReserved() {
  emit("export-project");
}

function clearActiveSelection() {
  if (selectedKeyframe.value) {
    editorStore.selectKeyframe(null);
    renderCurveCharts();
    return;
  }

  activateTrack(null);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    if (isProjectDetailsOpen.value) {
      cancelProjectDetails();
      return;
    }

    closeTransientMenus();
    return;
  }

  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return;
  }

  const withCommand = event.ctrlKey || event.metaKey;

  if (event.code === "Space") {
    event.preventDefault();
    toggleTransport();
    return;
  }

  if (!withCommand && !event.altKey && event.key.toLowerCase() === "w") {
    event.preventDefault();
    stepMode("up");
    return;
  }

  if (!withCommand && !event.altKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    stepMode("down");
    return;
  }

  if (withCommand && event.key.toLowerCase() === "d") {
    event.preventDefault();
    clearActiveSelection();
    return;
  }

  if (event.key === "Delete") {
    deleteSelectedPoint();
  }
}

function handleGlobalPointerRelease() {
  if (isPreparingKeyframeDrag && !isDraggingKeyframe) {
    isPreparingKeyframeDrag = false;
    return;
  }

  stopCurrentKeyframeDrag();
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
    if (editorStore.playback.transport !== "playing" && !isDraggingKeyframe) {
      renderPlayheads();
    }
  },
  { immediate: true },
);

watch(
  () => editorStore.simulator.maxSpeed,
  () => {
    if (isPreparingKeyframeDrag || isDraggingKeyframe) return;

    renderAllCharts();
  },
);

watch(
  () =>
    [
      tracks.value,
      activeTrackId.value,
      activeCurveSet.value,
      editorStore.view.tool,
      selectedKeyframe.value,
    ] as const,
  () => {
    if (isPreparingKeyframeDrag || isDraggingKeyframe) return;

    renderCurveCharts();
    if (editorStore.playback.transport === "playing") {
      queueAudioPreviewSync();
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
  window.addEventListener("pointerup", handleGlobalPointerRelease);
  window.addEventListener("pointercancel", handleGlobalPointerRelease);
  window.addEventListener("mouseup", handleGlobalPointerRelease);
  window.addEventListener("touchend", handleGlobalPointerRelease);
  window.addEventListener("touchcancel", handleGlobalPointerRelease);
  window.addEventListener("blur", handleGlobalPointerRelease);
});

onBeforeUnmount(() => {
  stopAnimationLoop();
  if (audioPreviewSyncFrame !== null) {
    cancelAnimationFrame(audioPreviewSyncFrame);
    audioPreviewSyncFrame = null;
  }
  void audioEngine.dispose();
  stopCurrentKeyframeDrag();
  charts.forEach(({ stage }) => stage.destroy());
  charts.clear();
  resizeObservers.forEach((observer) => observer.disconnect());
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("pointerup", handleGlobalPointerRelease);
  window.removeEventListener("pointercancel", handleGlobalPointerRelease);
  window.removeEventListener("mouseup", handleGlobalPointerRelease);
  window.removeEventListener("touchend", handleGlobalPointerRelease);
  window.removeEventListener("touchcancel", handleGlobalPointerRelease);
  window.removeEventListener("blur", handleGlobalPointerRelease);
});
</script>

<template>
  <main class="editor-shell" @click="closeTransientMenus">
    <header class="titlebar" data-tauri-drag-region>
      <div class="title-lockup">
        <h1>Motor Sound Editor</h1>
        <span>{{ meta?.name ?? "Untitled" }}</span>
      </div>
      <div class="window-controls">
        <button
          type="button"
          aria-label="Minimize"
          @click.stop="minimizeWindow"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" /></svg>
        </button>
        <button
          type="button"
          aria-label="Maximize"
          @click.stop="toggleMaximizeWindow"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3h6v6H3z" />
          </svg>
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
        <img
          :src="iconKeyframe"
          class="toolbar-icon"
          alt=""
          aria-hidden="true"
        />
        <span>Keyframe</span>
      </button>

      <div class="speed-readout">
        <span>Current Speed</span>
        <label>
          <StyledNumberInput
            class="speed-readout-input"
            v-model="speedDraft"
            min="0"
            :max="editorStore.simulator.maxSpeed"
            step="0.1"
            aria-label="Current speed"
            @commit="commitSpeed"
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
      <div class="chart-panel">
        <div ref="pitchChartEl" class="chart-host" />
      </div>
      <div class="chart-panel">
        <div ref="volumeChartEl" class="chart-host" />
      </div>
    </section>

    <aside class="track-sidebar">
      <section class="panel track-layers">
        <header>
          <h2>Track Layers</h2>
          <div class="track-actions">
            <button type="button" aria-label="Add track" @click="addTrack">
              +
            </button>
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
          @change="
            activateTrack(($event.target as HTMLSelectElement).value || null)
          "
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
                :src="
                  track.visible === false ? iconPreviewClose : iconPreviewOpen
                "
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
            <input
              :value="activeTrack.name"
              type="text"
              @change="updateTrackName"
            />
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
              <StyledNumberInput
                :model-value="selectedPoint?.speed.toFixed(2) ?? ''"
                min="0"
                :max="editorStore.simulator.maxSpeed"
                step="0.1"
                :disabled="!selectedPoint"
                aria-label="Selected keyframe speed"
                @commit="updateSelectedPoint('speed', $event)"
              />
              <small>km/h</small>
            </div>
          </label>
          <label>
            <span>Y</span>
            <StyledNumberInput
              :model-value="selectedPoint?.value.toFixed(2) ?? ''"
              step="0.01"
              :disabled="!selectedPoint"
              aria-label="Selected keyframe value"
              @commit="updateSelectedPoint('value', $event)"
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
        <svg
          v-if="editorStore.playback.transport !== 'playing'"
          viewBox="0 0 24 24"
        >
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
        <StyledNumberInput
          :model-value="editorStore.simulator.maxSpeed"
          min="1"
          step="1"
          aria-label="Max speed"
          @commit="updateMaxSpeed"
        />
        <small>km/h</small>
      </label>

      <label class="transport-field">
        <span>Acceleration</span>
        <StyledNumberInput
          :model-value="editorStore.simulator.acceleration"
          min="0"
          step="0.1"
          aria-label="Acceleration"
          @commit="updateAcceleration"
        />
        <small>km/s²</small>
      </label>

      <span class="mode-readout">{{ modeLabel }} · {{ activeCurveSet }}</span>
      <span class="version">v{{ APP_VERSION }}</span>
    </footer>

    <div
      v-if="chartContextMenu.visible"
      class="context-menu chart-context-menu"
      :style="{
        left: `${chartContextMenu.x}px`,
        top: `${chartContextMenu.y}px`,
      }"
      @click.stop
    >
      <button type="button" @click="openProjectDetails">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8h.01" />
          <path d="M11 12h1v5h1" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        Project Details
      </button>
      <button
        type="button"
        :disabled="!activeTrack"
        @click="runChartContextAddKeyframe"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Add keyframe here
      </button>
      <button type="button" :disabled="!activeTrack" @click="openListEditor">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 6h14" />
          <path d="M5 12h14" />
          <path d="M5 18h14" />
        </svg>
        Open list view editor
      </button>
    </div>

    <div
      v-if="isProjectDetailsOpen && projectStats"
      class="modal-backdrop"
      @click.self="cancelProjectDetails"
      @click.stop
    >
      <form class="project-details-dialog" @submit.prevent="saveProjectDetails">
        <header>
          <h2>Project Details</h2>
          <button
            type="button"
            aria-label="Close project details"
            @click="cancelProjectDetails"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="m3 3 6 6M9 3 3 9" />
            </svg>
          </button>
        </header>

        <label>
          <span>Project name</span>
          <input v-model="projectNameDraft" type="text" />
        </label>

        <dl class="project-stats">
          <div>
            <dt>File path</dt>
            <dd>{{ projectStats.filePath }}</dd>
          </div>
          <div>
            <dt>Tracks</dt>
            <dd>{{ projectStats.trackCount }}</dd>
          </div>
          <div>
            <dt>Audio assets</dt>
            <dd>{{ projectStats.assetCount }}</dd>
          </div>
          <div>
            <dt>Assigned audio</dt>
            <dd>{{ projectStats.assignedAudioCount }}</dd>
          </div>
          <div>
            <dt>Keyframes</dt>
            <dd>{{ projectStats.keyframeCount }}</dd>
          </div>
          <div>
            <dt>Max speed</dt>
            <dd>{{ projectStats.maxSpeed }} km/h</dd>
          </div>
          <div>
            <dt>Acceleration</dt>
            <dd>{{ projectStats.acceleration }} m/s^2</dd>
          </div>
          <div>
            <dt>Brake deceleration</dt>
            <dd>{{ projectStats.brakeDeceleration }} m/s^2</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{{ formatProjectDate(projectStats.createdAt) }}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{{ formatProjectDate(projectStats.updatedAt) }}</dd>
          </div>
        </dl>

        <footer>
          <button class="ghost" type="button" @click="cancelProjectDetails">
            Cancel
          </button>
          <button class="primary" type="submit">Save</button>
        </footer>
      </form>
    </div>

    <div
      v-if="isListEditorOpen && listDraft"
      class="modal-backdrop"
      @click.self="cancelListEditor"
      @click.stop="
        closeListContextMenu();
        closeAddKeyframePanel();
      "
    >
      <section class="list-editor-dialog" aria-label="List view editor">
        <header>
          <div>
            <h2>List View Editor</h2>
            <span>{{ listEditorTrack?.name ?? "No active track" }}</span>
          </div>
          <button
            type="button"
            aria-label="Close list editor"
            @click="cancelListEditor"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="m3 3 6 6M9 3 3 9" />
            </svg>
          </button>
        </header>

        <div class="list-table-wrap">
          <table class="list-editor-table">
            <thead>
              <tr>
                <th colspan="4" @contextmenu="openListContextMenu($event, 'traction')">
                  traction
                </th>
                <th colspan="4" @contextmenu="openListContextMenu($event, 'brake')">
                  brake
                </th>
              </tr>
              <tr>
                <th>speed</th>
                <th>vol</th>
                <th>speed</th>
                <th>pit</th>
                <th>speed</th>
                <th>vol</th>
                <th>speed</th>
                <th>pit</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in listRows" :key="row">
                <td @contextmenu="openListContextMenu($event, 'traction', 'volume', row)">
                  <StyledNumberInput
                    v-if="getDraftKeyframe('traction', 'volume', row)"
                    step="0.01"
                    :model-value="
                      formatTwoDecimals(
                        getDraftKeyframe('traction', 'volume', row)?.speed,
                      )
                    "
                    aria-label="Traction volume speed"
                    @commit="
                      updateListCell(
                        'traction',
                        'volume',
                        row,
                        'speed',
                        $event,
                      )
                    "
                  />
                </td>
                <td @contextmenu="openListContextMenu($event, 'traction', 'volume', row)">
                  <StyledNumberInput
                    v-if="getDraftKeyframe('traction', 'volume', row)"
                    step="0.01"
                    :model-value="
                      formatTwoDecimals(
                        getDraftKeyframe('traction', 'volume', row)?.value,
                      )
                    "
                    aria-label="Traction volume value"
                    @commit="
                      updateListCell(
                        'traction',
                        'volume',
                        row,
                        'value',
                        $event,
                      )
                    "
                  />
                </td>
                <td @contextmenu="openListContextMenu($event, 'traction', 'pitch', row)">
                  <StyledNumberInput
                    v-if="getDraftKeyframe('traction', 'pitch', row)"
                    step="0.01"
                    :model-value="
                      formatTwoDecimals(
                        getDraftKeyframe('traction', 'pitch', row)?.speed,
                      )
                    "
                    aria-label="Traction pitch speed"
                    @commit="
                      updateListCell(
                        'traction',
                        'pitch',
                        row,
                        'speed',
                        $event,
                      )
                    "
                  />
                </td>
                <td @contextmenu="openListContextMenu($event, 'traction', 'pitch', row)">
                  <StyledNumberInput
                    v-if="getDraftKeyframe('traction', 'pitch', row)"
                    step="0.01"
                    :model-value="
                      formatTwoDecimals(
                        getDraftKeyframe('traction', 'pitch', row)?.value,
                      )
                    "
                    aria-label="Traction pitch value"
                    @commit="
                      updateListCell(
                        'traction',
                        'pitch',
                        row,
                        'value',
                        $event,
                      )
                    "
                  />
                </td>
                <td @contextmenu="openListContextMenu($event, 'brake', 'volume', row)">
                  <StyledNumberInput
                    v-if="getDraftKeyframe('brake', 'volume', row)"
                    step="0.01"
                    :model-value="
                      formatTwoDecimals(
                        getDraftKeyframe('brake', 'volume', row)?.speed,
                      )
                    "
                    aria-label="Brake volume speed"
                    @commit="
                      updateListCell(
                        'brake',
                        'volume',
                        row,
                        'speed',
                        $event,
                      )
                    "
                  />
                </td>
                <td @contextmenu="openListContextMenu($event, 'brake', 'volume', row)">
                  <StyledNumberInput
                    v-if="getDraftKeyframe('brake', 'volume', row)"
                    step="0.01"
                    :model-value="
                      formatTwoDecimals(
                        getDraftKeyframe('brake', 'volume', row)?.value,
                      )
                    "
                    aria-label="Brake volume value"
                    @commit="
                      updateListCell(
                        'brake',
                        'volume',
                        row,
                        'value',
                        $event,
                      )
                    "
                  />
                </td>
                <td @contextmenu="openListContextMenu($event, 'brake', 'pitch', row)">
                  <StyledNumberInput
                    v-if="getDraftKeyframe('brake', 'pitch', row)"
                    step="0.01"
                    :model-value="
                      formatTwoDecimals(
                        getDraftKeyframe('brake', 'pitch', row)?.speed,
                      )
                    "
                    aria-label="Brake pitch speed"
                    @commit="
                      updateListCell(
                        'brake',
                        'pitch',
                        row,
                        'speed',
                        $event,
                      )
                    "
                  />
                </td>
                <td @contextmenu="openListContextMenu($event, 'brake', 'pitch', row)">
                  <StyledNumberInput
                    v-if="getDraftKeyframe('brake', 'pitch', row)"
                    step="0.01"
                    :model-value="
                      formatTwoDecimals(
                        getDraftKeyframe('brake', 'pitch', row)?.value,
                      )
                    "
                    aria-label="Brake pitch value"
                    @commit="
                      updateListCell(
                        'brake',
                        'pitch',
                        row,
                        'value',
                        $event,
                      )
                    "
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer>
          <button class="ghost" type="button" @click="cancelListEditor">
            Cancel
          </button>
          <button class="primary" type="button" @click="applyListEditor">
            Apply
          </button>
        </footer>
      </section>
    </div>

    <div
      v-if="listContextMenu.visible"
      class="context-menu list-context-menu"
      :style="{ left: `${listContextMenu.x}px`, top: `${listContextMenu.y}px` }"
      @click.stop
    >
      <button type="button" @click="runListContextSync">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 7h11" />
          <path d="m15 4 3 3-3 3" />
          <path d="M17 17H6" />
          <path d="m9 14-3 3 3 3" />
        </svg>
        {{ listSyncLabel }}
      </button>
      <button type="button" @click="openListAddKeyframePanel">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Add keyframe
      </button>
      <button
        class="danger"
        type="button"
        :disabled="!canDeleteListContextKeyframe"
        @click="removeListContextKeyframe"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14" />
          <path d="M9 7V4h6v3" />
          <path d="M8 10v10h8V10" />
        </svg>
        Delete current keyframe
      </button>
    </div>

    <form
      v-if="addKeyframePanel.visible"
      class="add-keyframe-panel"
      :style="{ left: `${addKeyframePanel.x}px`, top: `${addKeyframePanel.y}px` }"
      @submit.prevent="confirmListAddKeyframe"
      @click.stop
    >
      <label>
        <span>Type</span>
        <select v-model="addKeyframePanel.kind">
          <option value="volume">Volume</option>
          <option value="pitch">Pitch</option>
        </select>
      </label>
      <label>
        <span>Speed</span>
        <StyledNumberInput
          v-model="addKeyframePanel.speed"
          min="0"
          :max="editorStore.simulator.maxSpeed"
          step="0.01"
          aria-label="New keyframe speed"
        />
      </label>
      <label>
        <span>Value</span>
        <StyledNumberInput
          v-model="addKeyframePanel.value"
          :min="CURVE_MIN_VALUE[addKeyframePanel.kind]"
          :max="CURVE_MAX_VALUE[addKeyframePanel.kind]"
          step="0.01"
          aria-label="New keyframe value"
        />
      </label>
      <footer>
        <button class="ghost" type="button" @click="closeAddKeyframePanel">
          Cancel
        </button>
        <button class="primary" type="submit">Add</button>
      </footer>
    </form>

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
  overflow: hidden;
  background: #20262b;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  transition:
    width 0.3s ease,
    background 0.3s ease;
}

.tool-button {
  position: relative;
  display: grid;
  height: 90px;
  gap: 8px;
  place-items: center;
  min-height: 78px;
  padding: 14px 6px;
  transition:
    background 0.3s ease,
    opacity 0.2s ease;
}

.tool-button::before {
  position: absolute;
  top: 0px;
  bottom: 0px;
  left: 0;
  width: 5px;
  content: "";
  background: #5d86cb;
  opacity: 0;
  transition: opacity 0.2s ease;
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
  max-height: 24px;
  overflow: hidden;
  font-size: 15px;
  text-align: center;
  white-space: nowrap;
  transition:
    opacity 0.2s ease,
    max-height 0.2s ease,
    margin 0.2s ease;
}

.toolbar-icon {
  width: 36px;
  height: 36px;
  transition: transform 0.3s ease;
}

.tool-button:hover:not(:disabled) .toolbar-icon {
  transform: scale(1.06);
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
  width: 116px;
  align-items: baseline;
  justify-content: center;
  margin: 0 auto;
  white-space: nowrap;
}

.speed-readout-input {
  flex: 0 0 72px;
  min-width: 0;
  height: 32px;
  font-size: 14px;
  font-weight: 760;
  text-align: right;
}

.speed-readout-input :deep(input) {
  padding: 0 4px;
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
  touch-action: none;
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

.track-details :deep(.styled-number) {
  width: 100%;
  height: 30px;
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

.transport-field :deep(.styled-number) {
  width: 82px;
  height: 30px;
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

.context-menu {
  position: fixed;
  z-index: 70;
  display: grid;
  gap: 3px;
  width: 212px;
  padding: 6px;
  color: #f4f8fb;
  background: #202b32;
  border: 1px solid rgba(178, 213, 230, 0.16);
  border-radius: 7px;
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.35);
}

.context-menu button {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 34px;
  padding: 0 10px;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.context-menu button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.context-menu button:disabled {
  cursor: default;
  opacity: 0.42;
}

.context-menu button.danger {
  color: #ffb8b8;
}

.context-menu svg {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(4, 9, 12, 0.58);
  backdrop-filter: blur(6px);
}

.project-details-dialog {
  width: min(560px, calc(100vw - 56px));
  max-height: min(720px, calc(100vh - 78px));
  padding: 20px;
  overflow-y: auto;
  background: #23313a;
  border: 1px solid rgba(178, 213, 230, 0.18);
  border-radius: 8px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
}

.project-details-dialog header,
.project-details-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project-details-dialog header {
  margin-bottom: 18px;
}

.project-details-dialog h2 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0;
}

.project-details-dialog header button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.project-details-dialog header button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.project-details-dialog header svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.project-details-dialog label {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
  color: rgba(236, 246, 251, 0.78);
  font-size: 14px;
}

.project-details-dialog input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  color: #f5fbff;
  background: #141e23;
  border: 1px solid rgba(178, 213, 230, 0.12);
  border-radius: 6px;
  outline: none;
}

.project-details-dialog input:focus {
  border-color: rgba(139, 195, 224, 0.62);
}

.project-stats {
  display: grid;
  gap: 8px;
  margin: 0;
}

.project-stats div {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
  min-height: 32px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.project-stats dt,
.project-stats dd {
  margin: 0;
}

.project-stats dt {
  color: rgba(245, 248, 251, 0.58);
}

.project-stats dd {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #f5fbff;
}

.project-details-dialog footer {
  gap: 10px;
  justify-content: flex-end;
  margin-top: 18px;
}

.project-details-dialog footer button {
  height: 38px;
  min-width: 86px;
  padding: 0 16px;
  color: inherit;
  border-radius: 6px;
}

.list-editor-dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(980px, calc(100vw - 56px));
  max-height: min(720px, calc(100vh - 78px));
  min-height: 420px;
  overflow: hidden;
  background: #23313a;
  border: 1px solid rgba(178, 213, 230, 0.18);
  border-radius: 8px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
}

.list-editor-dialog > header,
.list-editor-dialog > footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
}

.list-editor-dialog > header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.list-editor-dialog h2 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0;
}

.list-editor-dialog header span {
  color: rgba(245, 248, 251, 0.62);
}

.list-editor-dialog header button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.list-editor-dialog header button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.list-editor-dialog header svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.list-table-wrap {
  min-height: 0;
  overflow: auto;
}

.list-editor-table {
  width: 100%;
  min-width: 840px;
  border-spacing: 0;
}

.list-editor-table th,
.list-editor-table td {
  width: 12.5%;
  height: 38px;
  padding: 4px;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.list-editor-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: rgba(245, 248, 251, 0.78);
  font-weight: 680;
  text-transform: lowercase;
  background: #1b2730;
}

.list-editor-table thead tr:first-child th {
  top: 0;
  color: #ffffff;
  font-size: 17px;
  background: #2c4050;
}

.list-editor-table thead tr:nth-child(2) th {
  top: 38px;
}

.list-editor-table td {
  background: rgba(15, 22, 26, 0.34);
}

.list-editor-table tr:nth-child(even) td {
  background: rgba(20, 31, 38, 0.5);
}

.list-editor-table input {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  color: #f5fbff;
  background: #141e23;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: none;
}

.list-editor-table input:focus {
  border-color: rgba(139, 195, 224, 0.62);
}

.list-editor-table :deep(.styled-number) {
  width: 100%;
  height: 30px;
}

.list-editor-dialog > footer {
  gap: 10px;
  justify-content: flex-end;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.list-editor-dialog footer button,
.add-keyframe-panel footer button {
  height: 38px;
  min-width: 86px;
  padding: 0 16px;
  color: inherit;
  border-radius: 6px;
}

.ghost {
  background: transparent;
  border: 1px solid rgba(178, 213, 230, 0.16);
}

.primary {
  background: #3d6074;
  border: 1px solid rgba(178, 213, 230, 0.18);
}

.add-keyframe-panel {
  position: fixed;
  z-index: 80;
  display: grid;
  gap: 10px;
  width: 244px;
  padding: 14px;
  color: #f4f8fb;
  background: #23313a;
  border: 1px solid rgba(178, 213, 230, 0.18);
  border-radius: 8px;
  box-shadow: 0 22px 62px rgba(0, 0, 0, 0.42);
}

.add-keyframe-panel label {
  display: grid;
  gap: 5px;
  color: rgba(245, 248, 251, 0.72);
  font-size: 14px;
}

.add-keyframe-panel input,
.add-keyframe-panel select {
  width: 100%;
  height: 34px;
  padding: 0 9px;
  color: #f5fbff;
  background: #141e23;
  border: 1px solid rgba(178, 213, 230, 0.12);
  border-radius: 5px;
  outline: none;
}

.add-keyframe-panel :deep(.styled-number) {
  width: 100%;
  height: 34px;
}

.add-keyframe-panel footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
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

@media (max-width: 1040px) {
  .editor-shell {
    grid-template-columns: 64px minmax(360px, 1fr) 236px;
    min-width: 760px;
  }

  .tool-button {
    height: 72px;
    min-height: 64px;
    gap: 0;
  }

  .tool-button span:last-child,
  .speed-readout > span,
  .speed-readout small {
    max-height: 0;
    margin: 0;
    overflow: hidden;
    opacity: 0;
  }

  .toolbar-icon {
    transform: scale(0.9);
  }

  .speed-readout {
    padding: 12px 4px;
  }

  .speed-readout label {
    width: 56px;
    margin-left: 15px;
  }

  .speed-readout-input {
    flex-basis: 52px;
    font-size: 10px;
    text-align: center;

  }

  .chart-workspace {
    gap: 10px;
    padding-right: 6px;
  }

  .transport-bar {
    grid-template-columns: 58px minmax(220px, 300px) minmax(150px, auto) 1fr;
    gap: 10px;
    padding: 0 72px 0 18px;
  }

  .transport-field:nth-of-type(2) {
    display: none;
  }
}

@media (max-width: 860px) {
  .editor-shell {
    grid-template-columns: 64px minmax(320px, 1fr);
    grid-template-rows:
      var(--app-titlebar-height) minmax(0, 1fr) 246px
      var(--app-bottombar-height);
    min-width: 680px;
  }

  .chart-workspace {
    grid-column: 2;
    grid-row: 2;
  }

  .track-sidebar {
    grid-column: 1 / -1;
    grid-row: 3;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    border-left: 0;
  }

  .transport-bar {
    grid-row: 4;
  }

  .panel {
    border-bottom: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
  }
}
</style>
