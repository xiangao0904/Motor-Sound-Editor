<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import HomePage from "@/pages/HomePage.vue";
import EditorPage from "@/pages/EditorPage.vue";
import {
  ensureBmsExtension,
  readFileModifiedAt,
  restoreDocumentObjectUrls,
  saveBmsProject,
} from "@/services/bmsProject";
import { useAssetPayloadStore } from "@/stores/assetPayloads";
import { useEditorStore } from "@/stores/editor";
import { useHistoryStore } from "@/stores/history";
import { useNotificationStore } from "@/stores/notifications";
import { useProjectStore } from "@/stores/project";
import { useRecentProjectsStore } from "@/stores/recentProjects";
import { createProjectPreview } from "@/utils/projectPreview";

type AppView = "home" | "editor";
type PendingExitAction = "home" | "close";

const currentView = ref<AppView>("home");
const pendingExitAction = ref<PendingExitAction | null>(null);
const isSavingBeforeExit = ref(false);
const projectStore = useProjectStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();
const assetPayloadStore = useAssetPayloadStore();
const notificationStore = useNotificationStore();
const recentProjectsStore = useRecentProjectsStore();

const hasProject = computed(() => projectStore.hasProject);
let allowNextClose = false;
let skipNextBeforeUnload = false;
let unlistenCloseRequested: (() => void) | null = null;

function openEditor() {
  const meta = projectStore.meta;

  if (meta) {
    editorStore.initializeFromProject(
      meta.maxSpeed,
      meta.acceleration,
      meta.brakeDeceleration,
    );
  }

  editorStore.setActiveTrackId(projectStore.activeTrackId);
  historyStore.clear();
  historyStore.pushSnapshot(
    "Open project",
    projectStore.document,
    editorStore.runtime,
  );
  currentView.value = "editor";
}

function finishReturnHome() {
  editorStore.pause();
  currentView.value = "home";
}

function requestReturnHome() {
  if (currentView.value === "editor" && projectStore.dirty) {
    pendingExitAction.value = "home";
    return;
  }

  finishReturnHome();
}

async function persistProject(saveAs = false) {
  const document = projectStore.document;
  if (!document) return false;

  let filePath = projectStore.currentFilePath;

  if (saveAs || !filePath) {
    const selected = await save({
      title: saveAs ? "Save Project As" : "Save Project",
      defaultPath: `${document.project.meta.name}.bms`,
      filters: [{ name: "BMS Project", extensions: ["bms"] }],
    });

    if (!selected) return false;
    filePath = ensureBmsExtension(selected);
  }

  try {
    await saveBmsProject(document, filePath, assetPayloadStore.payloads);
    projectStore.markSaved(filePath);
    recentProjectsStore.upsertProject({
      name: document.project.meta.name,
      filePath,
      lastModified: await readFileModifiedAt(filePath),
      ...createProjectPreview(document),
    });
    historyStore.pushSnapshot(
      "Save project",
      projectStore.document,
      editorStore.runtime,
    );
    notificationStore.showToast("Project saved successfully");
    return true;
  } catch (error) {
    console.error("Project save failed", error);
    notificationStore.showToast("Project could not be saved");
    return false;
  }
}

function applyUndo() {
  const document = projectStore.document;
  if (!document || currentView.value !== "editor") return;

  const snapshot = historyStore.undo(document, editorStore.runtime);
  if (!snapshot) {
    notificationStore.showToast("Nothing to undo");
    return;
  }

  projectStore.replaceDocument(
    restoreDocumentObjectUrls(snapshot.document, assetPayloadStore.payloads),
  );
  editorStore.replaceRuntime(snapshot.editor);
  notificationStore.showToast("Undo applied");
}

function applyRedo() {
  const document = projectStore.document;
  if (!document || currentView.value !== "editor") return;

  const snapshot = historyStore.redo(document, editorStore.runtime);
  if (!snapshot) {
    notificationStore.showToast("Nothing to redo");
    return;
  }

  projectStore.replaceDocument(
    restoreDocumentObjectUrls(snapshot.document, assetPayloadStore.payloads),
  );
  editorStore.replaceRuntime(snapshot.editor);
  notificationStore.showToast("Redo applied");
}

function isTextEditingTarget(target: EventTarget | null) {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  return target instanceof HTMLElement && target.isContentEditable;
}

function handleGlobalKeydown(event: KeyboardEvent) {
  const withCommand = event.ctrlKey || event.metaKey;
  if (!withCommand) return;

  const key = event.key.toLowerCase();

  if (key === "s" && currentView.value === "editor") {
    event.preventDefault();
    void persistProject(event.shiftKey);
    return;
  }

  if (key === "z" && currentView.value === "editor") {
    event.preventDefault();
    if (event.shiftKey) {
      applyRedo();
    } else {
      applyUndo();
    }
    return;
  }

  if (key === "y" && currentView.value === "editor") {
    event.preventDefault();
    applyRedo();
    return;
  }

  if (isTextEditingTarget(event.target)) return;
}

function continuePendingExit() {
  const action = pendingExitAction.value;
  pendingExitAction.value = null;

  if (action === "home") {
    finishReturnHome();
    return;
  }

  if (action === "close") {
    allowNextClose = true;
    skipNextBeforeUnload = true;
    void getCurrentWindow().close();
  }
}

async function saveAndContinueExit() {
  if (!pendingExitAction.value) return;

  isSavingBeforeExit.value = true;
  const saved = await persistProject(false);
  isSavingBeforeExit.value = false;

  if (saved) {
    continuePendingExit();
  }
}

function leaveWithoutSaving() {
  continuePendingExit();
}

function cancelPendingExit() {
  pendingExitAction.value = null;
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (allowNextClose || skipNextBeforeUnload) return;
  if (currentView.value !== "editor" || !projectStore.dirty) return;

  event.preventDefault();
  event.returnValue = "";
}

onMounted(async () => {
  window.addEventListener("keydown", handleGlobalKeydown, { capture: true });
  window.addEventListener("beforeunload", handleBeforeUnload);
  try {
    unlistenCloseRequested = await getCurrentWindow().onCloseRequested((event) => {
      if (allowNextClose) {
        allowNextClose = false;
        return;
      }

      if (currentView.value === "editor" && projectStore.dirty) {
        event.preventDefault();
        pendingExitAction.value = "close";
      }
    });
  } catch {
    // Browser-only dev previews do not expose Tauri window events.
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalKeydown, { capture: true });
  window.removeEventListener("beforeunload", handleBeforeUnload);
  unlistenCloseRequested?.();
});
</script>

<template>
  <HomePage v-if="currentView === 'home'" @open-editor="openEditor" />
  <EditorPage
    v-else-if="hasProject"
    @return-home="requestReturnHome"
    @project-closed="requestReturnHome"
    @save-project="() => void persistProject(false)"
  />
  <HomePage v-else @open-editor="openEditor" />
  <div
    v-if="pendingExitAction"
    class="confirm-backdrop"
    role="presentation"
    @click.self="cancelPendingExit"
  >
    <section class="confirm-dialog" role="dialog" aria-modal="true">
      <h2>Unsaved changes</h2>
      <p>The current project has unsaved operations. Do you want to save before leaving?</p>
      <footer>
        <button class="ghost" type="button" :disabled="isSavingBeforeExit" @click="leaveWithoutSaving">
          Don't Save
        </button>
        <button class="ghost" type="button" :disabled="isSavingBeforeExit" @click="cancelPendingExit">
          Cancel
        </button>
        <button class="primary" type="button" :disabled="isSavingBeforeExit" @click="saveAndContinueExit">
          {{ isSavingBeforeExit ? "Saving" : "Save" }}
        </button>
      </footer>
    </section>
  </div>
  <p v-if="notificationStore.message" class="global-toast" role="status">
    {{ notificationStore.message }}
  </p>
</template>

<style>
:root {
  --app-titlebar-height: 69px;
  --app-bottombar-height: 55px;
  --app-titlebar-bg: #22272b;
  --app-titlebar-padding: 0 20px 0 24px;
  --app-titlebar-font-size: 31px;
  --app-version-right: 14px;
  --app-version-bottom: 15px;
  color: #f2f7fb;
  background: #151c21;
  font-family:
    Inter,
    "Segoe UI",
    "Microsoft YaHei",
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.4;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

* {
  box-sizing: border-box;
  scrollbar-color: #526a7b rgba(13, 20, 25, 0.22);
  scrollbar-width: thin;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

button,
input {
  font: inherit;
}

button {
  color: inherit;
  cursor: pointer;
}

svg {
  display: block;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: rgba(13, 20, 25, 0.22);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #5d7383, #3f5361);
  border: 2px solid rgba(13, 20, 25, 0.22);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #71899a, #526a7b);
}

::-webkit-scrollbar-corner {
  background: transparent;
}

.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(4, 9, 12, 0.58);
  backdrop-filter: blur(6px);
}

.confirm-dialog {
  width: min(430px, calc(100vw - 48px));
  padding: 20px;
  color: #f4f8fb;
  background: #23313a;
  border: 1px solid rgba(178, 213, 230, 0.18);
  border-radius: 8px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
}

.confirm-dialog h2 {
  margin: 0 0 8px;
  font-size: 22px;
  letter-spacing: 0;
}

.confirm-dialog p {
  margin: 0;
  color: rgba(236, 246, 251, 0.76);
}

.confirm-dialog footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.confirm-dialog button {
  height: 38px;
  min-width: 86px;
  padding: 0 16px;
  border-radius: 6px;
}

.confirm-dialog button:disabled {
  cursor: default;
  opacity: 0.55;
}

.confirm-dialog .ghost {
  background: transparent;
  border: 1px solid rgba(178, 213, 230, 0.16);
}

.confirm-dialog .primary {
  background: #3d6074;
  border: 1px solid rgba(178, 213, 230, 0.18);
}

.global-toast {
  position: fixed;
  right: 18px;
  bottom: 68px;
  z-index: 1000;
  margin: 0;
  padding: 10px 14px;
  color: #eef8fd;
  background: rgba(27, 39, 46, 0.94);
  border: 1px solid rgba(178, 213, 230, 0.16);
  border-radius: 7px;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.24);
}
</style>
