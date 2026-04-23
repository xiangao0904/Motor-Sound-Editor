<script setup lang="ts">
import { computed, ref } from "vue";
import { save } from "@tauri-apps/plugin-dialog";

import {
  exportBveProject,
  hasOggExportTracks,
} from "@/services/bveExport";
import type { ID } from "@/types/common";
import type { ProjectDocument } from "@/types/project";

type ExportDialogFormat = "bve" | "openbve" | "mtr";

const props = defineProps<{
  document: ProjectDocument;
  assetPayloads: Map<ID, Uint8Array>;
}>();

const emit = defineEmits<{
  close: [];
  exported: [message: string];
  failed: [message: string];
}>();

const sampleRates = [22050, 32000, 44100, 48000, 96000];
const selectedFormat = ref<ExportDialogFormat>("bve");
const sampleRate = ref(44100);
const isExporting = ref(false);
const localError = ref("");

const hasOggTracks = computed(() =>
  hasOggExportTracks(props.document, props.assetPayloads),
);

function ensureZipExtension(filePath: string): string {
  return /\.zip$/i.test(filePath) ? filePath : `${filePath}.zip`;
}

async function runExport() {
  if (selectedFormat.value !== "bve") return;

  localError.value = "";
  const selected = await save({
    title: "Export BVE Package",
    defaultPath: `${props.document.project.meta.name}-BVE.zip`,
    filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
  });

  if (!selected) return;

  isExporting.value = true;
  try {
    await exportBveProject(
      props.document,
      props.assetPayloads,
      ensureZipExtension(selected),
      {
        format: "bve",
        sampleRate: sampleRate.value,
      },
    );
    emit("exported", "BVE export completed");
  } catch (error) {
    console.error("BVE export failed", error);
    const message = error instanceof Error ? error.message : "Export failed";
    localError.value = message;
    emit("failed", message);
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <form class="export-dialog" @submit.prevent="runExport">
      <header>
        <h2>Export File</h2>
        <button
          type="button"
          aria-label="Close export dialog"
          :disabled="isExporting"
          @click="emit('close')"
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="m3 3 6 6M9 3 3 9" />
          </svg>
        </button>
      </header>

      <label>
        <span>Export format</span>
        <select v-model="selectedFormat" :disabled="isExporting">
          <option value="bve">BVE</option>
          <option value="openbve" disabled>OpenBVE</option>
          <option value="mtr" disabled>MTR</option>
        </select>
      </label>

      <label>
        <span>Sample rate</span>
        <select v-model.number="sampleRate" :disabled="isExporting">
          <option v-for="rate in sampleRates" :key="rate" :value="rate">
            {{ rate }} Hz
          </option>
        </select>
      </label>

      <p v-if="hasOggTracks" class="warning" role="status">
        Warn ogg file: OGG audio will be converted to WAV for BVE export.
      </p>
      <p v-if="localError" class="error" role="alert">{{ localError }}</p>

      <footer>
        <button
          class="ghost"
          type="button"
          :disabled="isExporting"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button class="primary" type="submit" :disabled="isExporting">
          {{ isExporting ? "Exporting" : "Export" }}
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1300;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(4, 9, 12, 0.58);
  backdrop-filter: blur(6px);
}

.export-dialog {
  width: min(440px, calc(100vw - 48px));
  padding: 20px;
  color: #f4f8fb;
  background: #23313a;
  border: 1px solid rgba(178, 213, 230, 0.18);
  border-radius: 8px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
}

.export-dialog header,
.export-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.export-dialog header {
  margin-bottom: 18px;
}

.export-dialog h2 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0;
}

.export-dialog header button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.export-dialog header button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.export-dialog header svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.export-dialog label {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
  color: rgba(236, 246, 251, 0.78);
  font-size: 14px;
}

.export-dialog select {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  color: #f5fbff;
  background: #141e23;
  border: 1px solid rgba(178, 213, 230, 0.12);
  border-radius: 6px;
  outline: none;
}

.export-dialog select:focus {
  border-color: rgba(139, 195, 224, 0.62);
}

.warning,
.error {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 6px;
}

.warning {
  color: #ffe5b7;
  background: rgba(153, 106, 34, 0.18);
  border: 1px solid rgba(255, 193, 112, 0.2);
}

.error {
  color: #ffcaca;
  background: rgba(150, 55, 55, 0.18);
  border: 1px solid rgba(255, 143, 143, 0.22);
}

.export-dialog footer {
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}

.export-dialog footer button {
  height: 38px;
  min-width: 86px;
  padding: 0 16px;
  color: inherit;
  border-radius: 6px;
}

.export-dialog button:disabled {
  cursor: default;
  opacity: 0.55;
}

.export-dialog .ghost {
  background: transparent;
  border: 1px solid rgba(178, 213, 230, 0.16);
}

.export-dialog .primary {
  background: #3d6074;
  border: 1px solid rgba(178, 213, 230, 0.18);
}
</style>
