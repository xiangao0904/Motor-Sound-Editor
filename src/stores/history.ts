import { computed, ref } from "vue";
import { defineStore } from "pinia";

import type { EditorRuntimeState } from "@/types/editor";
import type { HistorySnapshot } from "@/types/history";
import type { ProjectDocument } from "@/types/project";
import { deepClone } from "@/utils/clone";

export const useHistoryStore = defineStore("history", () => {
  const undoStack = ref<HistorySnapshot[]>([]);
  const redoStack = ref<HistorySnapshot[]>([]);
  const maxSteps = ref(50);

  const canUndo = computed(() => undoStack.value.length > 1);
  const canRedo = computed(() => redoStack.value.length > 0);

  function clear() {
    undoStack.value = [];
    redoStack.value = [];
  }

  function setMaxSteps(value: number) {
    maxSteps.value = Math.max(1, value);
    if (undoStack.value.length > maxSteps.value) {
      undoStack.value = undoStack.value.slice(-maxSteps.value);
    }
  }

  function createSnapshot(
    label: string,
    document: ProjectDocument,
    editor: EditorRuntimeState,
  ): HistorySnapshot {
    return {
      label,
      timestamp: Date.now(),
      document: deepClone(document),
      editor: deepClone(editor),
    };
  }

  function pushSnapshot(
    label: string,
    document: ProjectDocument | null,
    editor: EditorRuntimeState,
  ) {
    if (!document) return;

    const snapshot = createSnapshot(label, document, editor);
    undoStack.value.push(snapshot);

    if (undoStack.value.length > maxSteps.value) {
      undoStack.value.shift();
    }

    redoStack.value = [];
  }

  function undo(
    currentDocument: ProjectDocument,
    currentEditor: EditorRuntimeState,
  ) {
    if (undoStack.value.length <= 1) return null;

    const currentSnapshot = createSnapshot(
      "current",
      currentDocument,
      currentEditor,
    );
    const popped = undoStack.value.pop();
    if (!popped) return null;

    redoStack.value.push(currentSnapshot);

    const previous = undoStack.value[undoStack.value.length - 1];
    if (!previous) return null;

    return {
      document: deepClone(previous.document),
      editor: deepClone(previous.editor),
      label: previous.label,
    };
  }

  function redo(
    currentDocument: ProjectDocument,
    currentEditor: EditorRuntimeState,
  ) {
    const next = redoStack.value.pop();
    if (!next) return null;

    const currentSnapshot = createSnapshot(
      "current",
      currentDocument,
      currentEditor,
    );
    undoStack.value.push(currentSnapshot);

    return {
      document: deepClone(next.document),
      editor: deepClone(next.editor),
      label: next.label,
    };
  }

  return {
    undoStack,
    redoStack,
    maxSteps,
    canUndo,
    canRedo,

    clear,
    setMaxSteps,
    pushSnapshot,
    undo,
    redo,
  };
});
