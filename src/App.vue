<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { save } from "@tauri-apps/plugin-dialog";
import HomePage from "@/pages/HomePage.vue";
import EditorPage from "@/pages/EditorPage.vue";
import {
  ensureBmsExtension,
  readFileModifiedAt,
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

const currentView = ref<AppView>("home");
const projectStore = useProjectStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();
const assetPayloadStore = useAssetPayloadStore();
const notificationStore = useNotificationStore();
const recentProjectsStore = useRecentProjectsStore();

const hasProject = computed(() => projectStore.hasProject);

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

function returnHome() {
  editorStore.pause();
  currentView.value = "home";
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

  projectStore.replaceDocument(snapshot.document);
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

  projectStore.replaceDocument(snapshot.document);
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

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown, { capture: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalKeydown, { capture: true });
});
</script>

<template>
  <HomePage v-if="currentView === 'home'" @open-editor="openEditor" />
  <EditorPage
    v-else-if="hasProject"
    @return-home="returnHome"
    @project-closed="returnHome"
    @save-project="() => void persistProject(false)"
  />
  <HomePage v-else @open-editor="openEditor" />
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
