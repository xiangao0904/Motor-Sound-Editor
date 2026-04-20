import type { ProjectDocument } from "./project";
import type { EditorRuntimeState } from "./editor";

export interface HistorySnapshot {
  label: string;
  timestamp: number;
  document: ProjectDocument;
  editor: EditorRuntimeState;
}

export interface HistoryState {
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  maxSteps: number;
}
