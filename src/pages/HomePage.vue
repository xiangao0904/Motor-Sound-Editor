<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { APP_VERSION } from "@/types/project";
import { useProjectStore } from "@/stores/project";

import iconNewFile from "@/assets/icons/newfile.png";
import iconOpenFile from "@/assets/icons/openfile.png";
import iconSettings from "@/assets/icons/settings.png";

type SortKey = "date" | "name";

interface RecentProject {
  id: string;
  name: string;
  filePath: string;
  lastModified: string;
  pitch: number[];
  volume: number[];
}

const emit = defineEmits<{
  "open-editor": [];
}>();

const projectStore = useProjectStore();

const searchQuery = ref("");
const sortKey = ref<SortKey>("date");
const contextProjectId = ref<string | null>(null);
const contextMenu = reactive({ visible: false, x: 0, y: 0 });
const isCreateDialogOpen = ref(false);
const toast = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

const newProject = reactive({
  name: "",
  maxSpeed: 120,
  acceleration: 1.2,
});

const recentProjects = ref<RecentProject[]>([
  {
    id: "als-vvvf",
    name: "Alstom VVVF",
    filePath: "D:/BVE/Sounds/Alstom VVVF",
    lastModified: "2021-12-23",
    pitch: [78, 32, 20, 37, 48, 58, 64, 69, 72],
    volume: [82, 47, 40, 35, 33, 30, 28, 27, 26],
  },
  {
    id: "siemens-gto",
    name: "Siemens GTO",
    filePath: "D:/BVE/Sounds/Siemens GTO",
    lastModified: "2021-12-23",
    pitch: [79, 34, 19, 25, 50, 60, 67, 72, 75],
    volume: [83, 35, 28, 45, 55, 62, 68, 71, 73],
  },
  {
    id: "mitsubishi-gto",
    name: "Mitsubishi GTO",
    filePath: "D:/BVE/Sounds/Mitsubishi GTO",
    lastModified: "2021-12-23",
    pitch: [80, 38, 19, 34, 46, 54, 61, 67, 70],
    volume: [81, 36, 26, 23, 45, 57, 64, 68, 69],
  },
  {
    id: "e233-series",
    name: "E233 Series",
    filePath: "D:/BVE/Sounds/E233 Series",
    lastModified: "2021-12-23",
    pitch: [78, 33, 22, 40, 50, 59, 63, 66, 69],
    volume: [82, 45, 35, 30, 28, 27, 26, 25, 25],
  },
  {
    id: "e233-series-alt",
    name: "E233 Series",
    filePath: "D:/BVE/Sounds/E233 Series Alt",
    lastModified: "2021-12-23",
    pitch: [82, 42, 22, 34, 45, 55, 61, 65, 68],
    volume: [84, 47, 43, 39, 34, 31, 28, 27, 26],
  },
  {
    id: "mitsubishi-gto-low",
    name: "Mitsubishi GTO",
    filePath: "D:/BVE/Sounds/Mitsubishi GTO Low",
    lastModified: "2021-12-23",
    pitch: [82, 23, 23, 41, 52, 61, 66, 70, 72],
    volume: [82, 31, 22, 20, 39, 52, 61, 67, 70],
  },
]);

const filteredProjects = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  const list = query
    ? recentProjects.value.filter((project) =>
        project.name.toLocaleLowerCase().includes(query),
      )
    : [...recentProjects.value];

  return list.sort((a, b) => {
    if (sortKey.value === "name") {
      return a.name.localeCompare(b.name);
    }

    return (
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
  });
});

const contextProject = computed(
  () =>
    recentProjects.value.find(
      (project) => project.id === contextProjectId.value,
    ) ?? null,
);

function linePoints(values: number[]): string {
  const maxIndex = values.length - 1;

  return values
    .map((value, index) => {
      const x = maxIndex === 0 ? 0 : (index / maxIndex) * 100;
      return `${x.toFixed(1)},${value.toFixed(1)}`;
    })
    .join(" ");
}

function showToast(message: string) {
  toast.value = message;
  window.setTimeout(() => {
    if (toast.value === message) {
      toast.value = "";
    }
  }, 2200);
}

function seedTracks() {
  if (projectStore.tracks.length > 0) return;

  const colors = ["#FFE796", "#8BB3FF", "#84D26D", "#F28B82"];
  colors.forEach((color, index) => {
    const track = projectStore.addTrack(`motor${index + 1}`);
    if (track) {
      projectStore.updateTrack(track.id, { color });
    }
  });
}

function openCreateDialog() {
  closeContextMenu();
  isCreateDialogOpen.value = true;
}

function closeCreateDialog() {
  isCreateDialogOpen.value = false;
}

function createProject() {
  const name = newProject.name.trim() || "Untitled Project";

  projectStore.createNewProject({
    name,
    maxSpeed: newProject.maxSpeed,
    acceleration: newProject.acceleration,
  });
  seedTracks();
  const today = new Date().toISOString().slice(0, 10);

  recentProjects.value.unshift({
    id: crypto.randomUUID(),
    name,
    filePath: "Unsaved project",
    lastModified: today,
    pitch: [80, 38, 24, 32, 48, 58, 64, 69, 72],
    volume: [82, 48, 38, 34, 31, 29, 28, 27, 26],
  });

  newProject.name = "";
  newProject.maxSpeed = 120;
  newProject.acceleration = 1.2;
  closeCreateDialog();
  emit("open-editor");
}

function browseFile() {
  closeContextMenu();
  fileInput.value?.click();
}

function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  recentProjects.value.unshift({
    id: crypto.randomUUID(),
    name: file.name.replace(/\.bms$/i, ""),
    filePath: file.name,
    lastModified: new Date(file.lastModified || Date.now())
      .toISOString()
      .slice(0, 10),
    pitch: [80, 30, 22, 35, 47, 55, 61, 66, 70],
    volume: [83, 45, 36, 31, 28, 26, 25, 25, 24],
  });

  projectStore.createNewProject({
    name: file.name.replace(/\.bms$/i, ""),
    maxSpeed: 120,
    acceleration: 1.2,
  });
  projectStore.setProjectFilePath(file.name);
  seedTracks();
  input.value = "";
  emit("open-editor");
}

function openProject(project: RecentProject) {
  closeContextMenu();
  projectStore.createNewProject({
    name: project.name,
    maxSpeed: 120,
    acceleration: 1.2,
  });
  projectStore.setProjectFilePath(project.filePath);
  seedTracks();
  emit("open-editor");
}

function openContextMenu(event: MouseEvent, project: RecentProject) {
  event.preventDefault();
  contextProjectId.value = project.id;
  contextMenu.x = Math.min(event.clientX, window.innerWidth - 176);
  contextMenu.y = Math.min(event.clientY, window.innerHeight - 112);
  contextMenu.visible = true;
}

function closeContextMenu() {
  contextMenu.visible = false;
}

function exportProject() {
  if (!contextProject.value) return;

  showToast(`Export reserved for ${contextProject.value.name}`);
  closeContextMenu();
}

function deleteProject() {
  if (!contextProject.value) return;

  const removedName = contextProject.value.name;
  recentProjects.value = recentProjects.value.filter(
    (project) => project.id !== contextProject.value?.id,
  );
  showToast(`${removedName} removed`);
  closeContextMenu();
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
</script>

<template>
  <main class="home-shell" @click="closeContextMenu">
    <header class="titlebar" data-tauri-drag-region>
      <h1>BVE5 Motor Assistance</h1>
      <div class="window-controls">
        <button type="button" aria-label="Minimize" @click.stop="minimizeWindow">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 6h8" />
          </svg>
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

    <aside class="sidebar" aria-label="Project actions">
      <div class="primary-actions">
        <button class="sidebar-action" type="button" @click.stop="openCreateDialog">
          <img :src="iconNewFile" class="sidebar-icon" alt="" aria-hidden="true" />
          <span>New Project</span>
        </button>

        <button class="sidebar-action" type="button" @click.stop="browseFile">
          <img :src="iconOpenFile" class="sidebar-icon" alt="" aria-hidden="true" />
          <span>Open File</span>
        </button>
      </div>

      <button
        class="sidebar-action settings-action"
        type="button"
        @click.stop="showToast('Settings reserved')"
      >
        <img :src="iconSettings" class="sidebar-icon" alt="" aria-hidden="true" />
        <span>Settings</span>
      </button>
    </aside>

    <section class="workspace">
      <div class="content">
        <div class="toolbar">
          <label class="search-field" aria-label="Search projects">
            <input v-model="searchQuery" type="search" placeholder="Search" />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="5.5" />
              <path d="m15 15 5 5" />
            </svg>
          </label>

          <div class="sort-control" aria-label="Sort projects">
            <span>Sort by:</span>
            <div class="segmented">
              <button
                type="button"
                :class="{ active: sortKey === 'date' }"
                @click.stop="sortKey = 'date'"
              >
                Date
              </button>
              <button
                type="button"
                :class="{ active: sortKey === 'name' }"
                @click.stop="sortKey = 'name'"
              >
                Name
              </button>
            </div>
          </div>
        </div>

        <section class="project-gallery" aria-label="Recent projects">
          <article
            v-for="project in filteredProjects"
            :key="project.id"
            class="project-card"
            tabindex="0"
            @click.stop="openProject(project)"
            @keydown.enter="openProject(project)"
            @contextmenu="openContextMenu($event, project)"
          >
            <div class="preview-panel" aria-hidden="true">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline
                  class="preview-line pitch"
                  :points="linePoints(project.pitch)"
                />
                <polyline
                  class="preview-line volume"
                  :points="linePoints(project.volume)"
                />
              </svg>
            </div>
            <h2>{{ project.name }}</h2>
            <p>Last modified: {{ project.lastModified.split("-").join("/") }}</p>
          </article>

          <div v-if="filteredProjects.length === 0" class="empty-state">
            <h2>No projects found</h2>
            <p>Try another file name or create a new motor sound project.</p>
          </div>
        </section>
      </div>
    </section>

    <footer class="bottom-bar">
      <span class="version">v{{ APP_VERSION }}</span>
    </footer>

    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
    >
      <button type="button" @click="exportProject">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Export
      </button>
      <button class="danger" type="button" @click="deleteProject">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14" />
          <path d="M9 7V4h6v3" />
          <path d="M8 10v10h8V10" />
        </svg>
        Delete
      </button>
    </div>

    <div
      v-if="isCreateDialogOpen"
      class="modal-backdrop"
      @click.self="closeCreateDialog"
    >
      <form class="project-dialog" @submit.prevent="createProject">
        <header>
          <h2>New Project</h2>
          <button type="button" aria-label="Close dialog" @click="closeCreateDialog">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="m3 3 6 6M9 3 3 9" />
            </svg>
          </button>
        </header>

        <label>
          <span>Project name</span>
          <input
            v-model="newProject.name"
            type="text"
            placeholder="My motor sound"
            autofocus
          />
        </label>

        <div class="dialog-grid">
          <label>
            <span>Max speed</span>
            <input
              v-model.number="newProject.maxSpeed"
              min="1"
              step="1"
              type="number"
            />
          </label>
          <label>
            <span>Acceleration</span>
            <input
              v-model.number="newProject.acceleration"
              min="0.1"
              step="0.1"
              type="number"
            />
          </label>
        </div>

        <footer>
          <button class="ghost" type="button" @click="closeCreateDialog">
            Cancel
          </button>
          <button class="primary" type="submit">Create</button>
        </footer>
      </form>
    </div>

    <p v-if="toast" class="toast" role="status">{{ toast }}</p>

    <input
      ref="fileInput"
      class="file-input"
      type="file"
      accept=".bms"
      @change="importFile"
    />
  </main>
</template>

<style scoped>
.home-shell {
  position: relative;
  display: grid;
  grid-template-rows: var(--app-titlebar-height) 1fr var(--app-bottombar-height);
  grid-template-columns: 128px 1fr;
  width: 100%;
  height: 100vh;
  min-width: 880px;
  min-height: 620px;
  overflow: hidden;
  color: #f4f8fb;
  background: #292e34;
}

.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  grid-column: 1 / -1;
  grid-row: 1;
  z-index: 100;
  height: var(--app-titlebar-height);
  margin: 0;
  padding: var(--app-titlebar-padding);
  background: var(--app-titlebar-bg);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
  user-select: none;
}

.titlebar h1 {
  margin: 0;
  font-size: var(--app-titlebar-font-size);
  font-weight: 780;
  letter-spacing: 0;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.window-controls button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: rgba(255, 255, 255, 0.86);
  background: transparent;
  border: 0;
  border-radius: 4px;
}

.window-controls button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.window-controls button:last-child:hover {
  background: #c54545;
}

.window-controls svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sidebar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  grid-row: 2;
  grid-column: 1;
  width: 100%;
  padding: 20px 0 0;
  overflow: hidden;
  background: #22272b;
  border-right: 1px solid rgba(160, 189, 203, 0.06);
  box-shadow: 12px 0 42px rgba(0, 0, 0, 0.14);
}

.bottom-bar {
  z-index: 10;
  display: flex;
  align-items: center;
  grid-row: 3;
  grid-column: 1 / 3;
  height: var(--app-bottombar-height);
  padding: 0 20px;
  background-color: #293038;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.primary-actions {
  display: grid;
}

.sidebar-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin-bottom: 4px;
  object-fit: contain;
  transition: transform 0.3s ease;
}

.sidebar-action {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 80px;
  padding: 0;
  background: transparent;
  border: 0;
  transition: all 0.3s ease;
}

.sidebar-action::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 5px;
  content: "";
  background-color: #4d85c2;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.sidebar-action:hover::before,
.sidebar-action:focus-visible::before {
  opacity: 1;
}

.sidebar-action:hover,
.sidebar-action:focus-visible {
  background: #292e34;
  outline: none;
}

.sidebar-action span {
  max-height: 20px;
  overflow: hidden;
  font-size: 14px;
  white-space: nowrap;
  opacity: 1;
  transition:
    opacity 0.2s ease,
    max-height 0.2s ease,
    margin 0.2s ease;
}

.workspace {
  position: relative;
  grid-row: 2;
  grid-column: 2;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 0 23px 28px 24px;
}

.content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 22px;
}

.toolbar {
  display: flex;
  gap: 24px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.search-field {
  position: relative;
  display: block;
  width: min(334px, 38vw);
}

.search-field input {
  width: 100%;
  height: 37px;
  padding: 0 44px 0 11px;
  color: #dce7ef;
  background: rgba(15, 22, 26, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  outline: none;
  box-shadow: inset 0 1px 5px rgba(0, 0, 0, 0.16);
}

.search-field input::placeholder {
  color: rgba(226, 235, 240, 0.62);
}

.search-field input:focus {
  border-color: rgba(137, 181, 204, 0.52);
  box-shadow: 0 0 0 3px rgba(90, 136, 160, 0.18);
}

.search-field svg {
  position: absolute;
  top: 50%;
  right: 13px;
  width: 19px;
  height: 19px;
  fill: none;
  stroke: rgba(226, 235, 240, 0.72);
  stroke-width: 2;
  transform: translateY(-50%);
}

.sort-control {
  display: flex;
  gap: 11px;
  align-items: center;
  color: #ffffff;
  font-size: 16px;
}

.segmented {
  display: flex;
  padding: 0;
  background: rgba(15, 22, 26, 0.42);
  border-radius: 6px;
}

.segmented button {
  min-width: 73px;
  height: 37px;
  padding: 0 18px;
  color: #ffffff;
  background: transparent;
  border: 0;
  border-radius: 6px;
}

.segmented button.active {
  background: #314354;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.project-gallery {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(auto-fill, minmax(284px, 1fr));
  gap: 12px 15px;
  height: calc(100% - 59px);
  padding-right: 16px;
  overflow-y: auto;
  scrollbar-color: #4c6070 transparent;
  scrollbar-width: thin;
}

.project-gallery::-webkit-scrollbar {
  width: 9px;
}

.project-gallery::-webkit-scrollbar-thumb {
  background: #4c6070;
  border-radius: 10px;
}

.project-card {
  display: flex;
  flex-direction: column;
  height: 254px;
  padding: 16px 17px 14px;
  background: linear-gradient(
    145deg,
    rgba(57, 78, 91, 0.88),
    rgba(43, 59, 69, 0.94)
  );
  border: 1px solid rgba(170, 207, 225, 0.06);
  border-radius: 8px;
  outline: none;
  box-shadow: 0 18px 32px rgba(0, 0, 0, 0.08);
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    background 160ms ease;
}

.project-card:hover,
.project-card:focus-visible {
  background: linear-gradient(
    145deg,
    rgba(64, 90, 106, 0.95),
    rgba(48, 67, 78, 0.98)
  );
  border-color: rgba(175, 218, 239, 0.22);
  transform: translateY(-1px);
}

.preview-panel {
  width: 100%;
  height: 137px;
  margin-bottom: 12px;
  overflow: hidden;
  background:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    #151d21;
  background-size: 26px 26px;
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 5px;
}

.preview-panel svg {
  width: 100%;
  height: 100%;
}

.preview-line {
  fill: none;
  stroke-width: 1.25;
  vector-effect: non-scaling-stroke;
}

.preview-line.pitch {
  stroke: #5285b9;
  filter: drop-shadow(0 0 2px rgba(82, 133, 185, 0.35));
}

.preview-line.volume {
  stroke: #d39a75;
  filter: drop-shadow(0 0 2px rgba(211, 154, 117, 0.28));
}

.project-card h2 {
  min-height: 26px;
  margin: 0 0 2px;
  overflow: hidden;
  color: #ffffff;
  font-size: 20px;
  font-weight: 720;
  line-height: 1.3;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.88);
  font-size: 16px;
  letter-spacing: 0;
}

.empty-state {
  grid-column: 1 / -1;
  align-self: start;
  padding: 38px;
  color: rgba(239, 246, 250, 0.75);
  text-align: center;
  border: 1px dashed rgba(168, 202, 219, 0.16);
  border-radius: 8px;
}

.empty-state h2 {
  margin: 0 0 6px;
  font-size: 22px;
}

.empty-state p {
  margin: 0;
}

.version {
  position: absolute;
  right: var(--app-version-right);
  bottom: var(--app-version-bottom);
  color: rgba(255, 255, 255, 0.52);
  font-size: 14px;
}

.context-menu {
  position: fixed;
  z-index: 30;
  display: grid;
  gap: 3px;
  width: 160px;
  padding: 6px;
  background: #202b32;
  border: 1px solid rgba(178, 213, 230, 0.16);
  border-radius: 7px;
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.35);
}

.context-menu button {
  display: flex;
  gap: 10px;
  align-items: center;
  height: 34px;
  padding: 0 10px;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.context-menu button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.context-menu button.danger {
  color: #ffb8b8;
}

.context-menu svg {
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
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgba(4, 9, 12, 0.58);
  backdrop-filter: blur(6px);
}

.project-dialog {
  width: min(440px, calc(100vw - 48px));
  padding: 20px;
  background: #23313a;
  border: 1px solid rgba(178, 213, 230, 0.18);
  border-radius: 8px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
}

.project-dialog header,
.project-dialog footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.project-dialog header {
  margin-bottom: 18px;
}

.project-dialog h2 {
  margin: 0;
  font-size: 22px;
}

.project-dialog header button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.project-dialog header button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.project-dialog header svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.project-dialog label {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
  color: rgba(236, 246, 251, 0.78);
  font-size: 14px;
}

.project-dialog input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  color: #f5fbff;
  background: #141e23;
  border: 1px solid rgba(178, 213, 230, 0.12);
  border-radius: 6px;
  outline: none;
}

.project-dialog input:focus {
  border-color: rgba(139, 195, 224, 0.62);
}

.dialog-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.project-dialog footer {
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}

.project-dialog footer button {
  height: 38px;
  min-width: 86px;
  padding: 0 16px;
  border-radius: 6px;
}

.project-dialog .ghost {
  background: transparent;
  border: 1px solid rgba(178, 213, 230, 0.16);
}

.project-dialog .primary {
  background: #3d6074;
  border: 1px solid rgba(178, 213, 230, 0.18);
}

.toast {
  position: fixed;
  right: 18px;
  bottom: 43px;
  z-index: 50;
  margin: 0;
  padding: 10px 14px;
  color: #eef8fd;
  background: rgba(27, 39, 46, 0.94);
  border: 1px solid rgba(178, 213, 230, 0.16);
  border-radius: 7px;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.24);
}

.file-input {
  display: none;
}

@media (max-width: 980px) {
  .home-shell {
    grid-template-columns: 64px 1fr;
  }

  .sidebar-action {
    gap: 0;
  }

  .sidebar-action span {
    max-height: 0;
    margin-top: 0;
    overflow: hidden;
    opacity: 0;
  }

  .sidebar-icon {
    transform: scale(0.9);
  }
}

.search-field input::-webkit-search-cancel-button {
  width: 16px;
  height: 16px;
  cursor: pointer;
  background-color: #9597a1;
  -webkit-appearance: none;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M18 6L6 18M6 6l12 12'%3E%3C/path%3E%3C/svg%3E");
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: contain;
}

.search-field input::-webkit-search-cancel-button:hover {
  background-color: #cb7f7f;
}
</style>
