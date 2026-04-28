import { computed, ref } from "vue";
import { defineStore } from "pinia";

export type AppLanguage = string;

export interface KeyframeSnapSettings {
  speedStep: number;
  valueStep: number;
}

export interface GridRenderSettings {
  xLineCount: number;
  pitchYLineCount: number;
  volumeYLineCount: number;
}

const DEFAULT_KEYFRAME_SNAP_SPEED_STEP = 0.5;
const DEFAULT_KEYFRAME_SNAP_VALUE_STEP = 0.2;
const DEFAULT_LANGUAGE: AppLanguage = "en";
const DEFAULT_GRID_X_LINE_COUNT = 13;
const DEFAULT_GRID_PITCH_Y_LINE_COUNT = 6;
const DEFAULT_GRID_VOLUME_Y_LINE_COUNT = 6;
const STORAGE_KEY = "motor-sound-editor-settings";

interface PersistedSettings {
  language?: string;
  keyframeSnap?: Partial<KeyframeSnapSettings>;
  grid?: Partial<GridRenderSettings>;
}

function normalizeSnapStep(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeLineCount(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 2
    ? Math.min(Math.round(value), 64)
    : fallback;
}

function normalizeLanguage(value: unknown): AppLanguage {
  return typeof value === "string" && value.trim() ? value : DEFAULT_LANGUAGE;
}

export function normalizeLanguageByAvailable(
  value: unknown,
  availableCodes: readonly string[],
) {
  const normalized = normalizeLanguage(value);
  if (availableCodes.length === 0) return DEFAULT_LANGUAGE;
  if (availableCodes.includes(normalized)) return normalized;
  if (availableCodes.includes(DEFAULT_LANGUAGE)) return DEFAULT_LANGUAGE;
  return availableCodes[0];
}

function readPersistedSettings(): PersistedSettings {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as PersistedSettings)
      : {};
  } catch {
    return {};
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const persisted = readPersistedSettings();

  const languageState = ref<AppLanguage>(normalizeLanguage(persisted.language));
  const keyframeSnapState = ref<KeyframeSnapSettings>({
    speedStep: normalizeSnapStep(
      Number(persisted.keyframeSnap?.speedStep),
      DEFAULT_KEYFRAME_SNAP_SPEED_STEP,
    ),
    valueStep: normalizeSnapStep(
      Number(persisted.keyframeSnap?.valueStep),
      DEFAULT_KEYFRAME_SNAP_VALUE_STEP,
    ),
  });
  const gridState = ref<GridRenderSettings>({
    xLineCount: normalizeLineCount(
      Number(persisted.grid?.xLineCount),
      DEFAULT_GRID_X_LINE_COUNT,
    ),
    pitchYLineCount: normalizeLineCount(
      Number(persisted.grid?.pitchYLineCount),
      DEFAULT_GRID_PITCH_Y_LINE_COUNT,
    ),
    volumeYLineCount: normalizeLineCount(
      Number(persisted.grid?.volumeYLineCount),
      DEFAULT_GRID_VOLUME_Y_LINE_COUNT,
    ),
  });

  const language = computed(() => languageState.value);
  const keyframeSnap = computed(() => keyframeSnapState.value);
  const grid = computed(() => gridState.value);

  function persist() {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        language: languageState.value,
        keyframeSnap: keyframeSnapState.value,
        grid: gridState.value,
      }),
    );
  }

  function setLanguage(value: AppLanguage) {
    languageState.value = normalizeLanguage(value);
    persist();
  }

  function setKeyframeSnapSpeedStep(value: number) {
    keyframeSnapState.value.speedStep = normalizeSnapStep(
      value,
      DEFAULT_KEYFRAME_SNAP_SPEED_STEP,
    );
    persist();
  }

  function setKeyframeSnapValueStep(value: number) {
    keyframeSnapState.value.valueStep = normalizeSnapStep(
      value,
      DEFAULT_KEYFRAME_SNAP_VALUE_STEP,
    );
    persist();
  }

  function setGridXLineCount(value: number) {
    gridState.value.xLineCount = normalizeLineCount(
      value,
      DEFAULT_GRID_X_LINE_COUNT,
    );
    persist();
  }

  function setGridPitchYLineCount(value: number) {
    gridState.value.pitchYLineCount = normalizeLineCount(
      value,
      DEFAULT_GRID_PITCH_Y_LINE_COUNT,
    );
    persist();
  }

  function setGridVolumeYLineCount(value: number) {
    gridState.value.volumeYLineCount = normalizeLineCount(
      value,
      DEFAULT_GRID_VOLUME_Y_LINE_COUNT,
    );
    persist();
  }

  return {
    language,
    keyframeSnap,
    grid,

    setLanguage,
    setKeyframeSnapSpeedStep,
    setKeyframeSnapValueStep,
    setGridXLineCount,
    setGridPitchYLineCount,
    setGridVolumeYLineCount,
  };
});
