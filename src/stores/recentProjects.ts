import { computed, ref } from "vue";
import { defineStore } from "pinia";

import type { ProjectCardItem } from "@/types/project";

const STORAGE_KEY = "bve5-motor-assistance:recent-projects";

function readStoredProjects(): ProjectCardItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as ProjectCardItem[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item) =>
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.filePath === "string" &&
          typeof item.lastModified === "string",
      )
      .map((item) => ({
        ...item,
        previewLines: Array.isArray(item.previewLines)
          ? item.previewLines
              .filter(
                (line) =>
                  line &&
                  typeof line.trackId === "string" &&
                  typeof line.color === "string" &&
                  Array.isArray(line.points),
              )
              .map((line) => ({
                trackId: line.trackId,
                color: line.color,
                points: line.points
                  .filter((value): value is number => typeof value === "number")
                  .map((value) => Number(value)),
              }))
          : [],
      }));
  } catch {
    return [];
  }
}

export const useRecentProjectsStore = defineStore("recentProjects", () => {
  const projects = ref<ProjectCardItem[]>(readStoredProjects());

  const sortedByDate = computed(() =>
    [...projects.value].sort(
      (a, b) =>
        new Date(b.lastModified).getTime() -
        new Date(a.lastModified).getTime(),
    ),
  );

  function persist() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.value));
  }

  function upsertProject(project: Omit<ProjectCardItem, "id"> & { id?: string }) {
    const id = project.id ?? project.filePath;
    const nextProject: ProjectCardItem = {
      id,
      name: project.name,
      filePath: project.filePath,
      lastModified: project.lastModified,
      previewImagePath: project.previewImagePath,
      previewLines: project.previewLines ?? [],
    };

    projects.value = [
      nextProject,
      ...projects.value.filter((item) => item.filePath !== project.filePath),
    ];
    persist();
  }

  function removeProject(projectId: string) {
    projects.value = projects.value.filter((project) => project.id !== projectId);
    persist();
  }

  return {
    projects,
    sortedByDate,
    upsertProject,
    removeProject,
  };
});
