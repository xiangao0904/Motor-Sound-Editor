<script setup lang="ts">
import { computed, ref } from "vue";
import HomePage from "@/pages/HomePage.vue";
import EditorPage from "@/pages/EditorPage.vue";
import { useEditorStore } from "@/stores/editor";
import { useHistoryStore } from "@/stores/history";
import { useProjectStore } from "@/stores/project";

type AppView = "home" | "editor";

const currentView = ref<AppView>("home");
const projectStore = useProjectStore();
const editorStore = useEditorStore();
const historyStore = useHistoryStore();

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
</script>

<template>
  <HomePage v-if="currentView === 'home'" @open-editor="openEditor" />
  <EditorPage
    v-else-if="hasProject"
    @return-home="returnHome"
    @project-closed="returnHome"
  />
  <HomePage v-else @open-editor="openEditor" />
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
</style>
