import { computed, ref } from "vue";
import { defineStore } from "pinia";

import type { ID } from "@/types/common";
import type {
  EditorRuntimeState,
  EditorTool,
  HoveredKeyframeRef,
  SelectedKeyframeRef,
  SimulatorMode,
  TransportState,
} from "@/types/editor";
import { createDefaultEditorRuntime } from "@/types/factories";

export const useEditorStore = defineStore("editor", () => {
  const runtime = ref<EditorRuntimeState>(createDefaultEditorRuntime());

  const simulator = computed(() => runtime.value.simulator);
  const playback = computed(() => runtime.value.playback);
  const selection = computed(() => runtime.value.selection);
  const view = computed(() => runtime.value.view);

  function initializeFromProject(
    maxSpeed = 120,
    acceleration = 1.2,
    brakeDeceleration = 1.2,
  ) {
    runtime.value = createDefaultEditorRuntime(
      maxSpeed,
      acceleration,
      brakeDeceleration,
    );
  }

  function resetEditor() {
    runtime.value = createDefaultEditorRuntime();
  }

  function setSimulatorMode(mode: SimulatorMode) {
    runtime.value.simulator.mode = mode;
  }

  function setCurrentSpeed(speed: number) {
    const normalized = Math.max(
      0,
      Math.min(speed, runtime.value.simulator.maxSpeed),
    );
    runtime.value.simulator.currentSpeed = normalized;
    runtime.value.playback.playheadSpeed = normalized;
  }

  function setMaxSpeed(maxSpeed: number) {
    runtime.value.simulator.maxSpeed = Math.max(0, maxSpeed);
    if (
      runtime.value.simulator.currentSpeed > runtime.value.simulator.maxSpeed
    ) {
      runtime.value.simulator.currentSpeed = runtime.value.simulator.maxSpeed;
    }
    if (
      runtime.value.playback.playheadSpeed > runtime.value.simulator.maxSpeed
    ) {
      runtime.value.playback.playheadSpeed = runtime.value.simulator.maxSpeed;
    }
  }

  function setAcceleration(acceleration: number) {
    runtime.value.simulator.acceleration = Math.max(0, acceleration);
  }

  function setBrakeDeceleration(brakeDeceleration: number) {
    runtime.value.simulator.brakeDeceleration = Math.max(0, brakeDeceleration);
  }

  function setTransport(transport: TransportState) {
    runtime.value.playback.transport = transport;
  }

  function play() {
    runtime.value.playback.transport = "playing";
    runtime.value.playback.audioEnabled = true;
  }

  function pause() {
    runtime.value.playback.transport = "paused";
  }

  function stop() {
    runtime.value.playback.transport = "stopped";
    runtime.value.playback.audioEnabled = false;
  }

  function togglePlayPause() {
    if (runtime.value.playback.transport === "playing") {
      pause();
    } else {
      play();
    }
  }

  function setAudioEnabled(enabled: boolean) {
    runtime.value.playback.audioEnabled = enabled;
  }

  function setTool(tool: EditorTool) {
    runtime.value.view.tool = tool;
  }

  function setActiveTrackId(trackId: ID | null) {
    runtime.value.selection.activeTrackId = trackId;
  }

  function selectKeyframe(selected: SelectedKeyframeRef | null) {
    runtime.value.selection.selectedKeyframe = selected;
  }

  function hoverKeyframe(hovered: HoveredKeyframeRef | null) {
    runtime.value.selection.hoveredKeyframe = hovered;
  }

  function clearSelection() {
    runtime.value.selection.selectedKeyframe = null;
    runtime.value.selection.hoveredKeyframe = null;
  }

  function clearActiveTrack() {
    runtime.value.selection.activeTrackId = null;
    clearSelection();
  }

  function setZoom(zoomX: number, zoomY: number) {
    runtime.value.view.zoomX = zoomX;
    runtime.value.view.zoomY = zoomY;
  }

  function setOffset(offsetX: number, offsetY: number) {
    runtime.value.view.offsetX = offsetX;
    runtime.value.view.offsetY = offsetY;
  }

  function replaceRuntime(next: EditorRuntimeState) {
    runtime.value = next;
  }

  return {
    runtime,
    simulator,
    playback,
    selection,
    view,

    initializeFromProject,
    resetEditor,
    setSimulatorMode,
    setCurrentSpeed,
    setMaxSpeed,
    setAcceleration,
    setBrakeDeceleration,
    setTransport,
    play,
    pause,
    stop,
    togglePlayPause,
    setAudioEnabled,
    setTool,
    setActiveTrackId,
    selectKeyframe,
    hoverKeyframe,
    clearSelection,
    clearActiveTrack,
    setZoom,
    setOffset,
    replaceRuntime,
  };
});
