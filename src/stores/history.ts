import { computed, ref } from "vue";
import { defineStore } from "pinia";

import type { EditorRuntimeState } from "@/types/editor";
import type { HistorySnapshot } from "@/types/history";
import type { ProjectDocument } from "@/types/project";
import {
  sanitizeEditorRuntime,
  sanitizeProjectDocument,
} from "@/utils/clone";

export const useHistoryStore = defineStore("history", () => {
  const undoStack = ref<HistorySnapshot[]>([]);
  const redoStack = ref<HistorySnapshot[]>([]);
  const maxSteps = ref(20);
  let debounceTimer: number | null = null;

  const canUndo = computed(() => undoStack.value.length > 1);
  const canRedo = computed(() => redoStack.value.length > 0);

  function clear() {
    cancelPendingSnapshot();

    undoStack.value = [];
    redoStack.value = [];
  }

  function cancelPendingSnapshot() {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
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
      document: sanitizeProjectDocument(document),
      editor: sanitizeEditorRuntime(editor),
    };
  }

  function pushSnapshot(
    label: string,
    document: ProjectDocument | null,
    editor: EditorRuntimeState,
  ) {
    if (!document) return;

    try {
      const snapshot = createSnapshot(label, document, editor);
      undoStack.value.push(snapshot);
    } catch (error) {
      console.error("History snapshot failed", error);
      return;
    }

    if (undoStack.value.length > maxSteps.value) {
      undoStack.value.shift();
    }

    redoStack.value = [];
  }

  function scheduleSnapshot(
    label: string,
    document: ProjectDocument | null,
    editor: EditorRuntimeState,
    debounceMs = 250,
  ) {
    cancelPendingSnapshot();

    debounceTimer = window.setTimeout(() => {
      pushSnapshot(label, document, editor);
      debounceTimer = null;
    }, debounceMs);
  }

  function undo(
    currentDocument: ProjectDocument,
    currentEditor: EditorRuntimeState,
  ) {
    cancelPendingSnapshot();

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
      document: sanitizeProjectDocument(previous.document),
      editor: sanitizeEditorRuntime(previous.editor),
      label: previous.label,
    };
  }

  function redo(
    _currentDocument: ProjectDocument,
    _currentEditor: EditorRuntimeState,
  ) {
    cancelPendingSnapshot();

    const next = redoStack.value.pop();
    if (!next) return null;
    undoStack.value.push(createSnapshot(next.label, next.document, next.editor));

    return {
      document: sanitizeProjectDocument(next.document),
      editor: sanitizeEditorRuntime(next.editor),
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
    cancelPendingSnapshot,
    setMaxSteps,
    pushSnapshot,
    scheduleSnapshot,
    undo,
    redo,
  };
});
