import type { ProjectDocument } from "./project";
import type { EditorRuntimeState } from "./editor";
import type { ID } from "./common";

export interface HistorySnapshot {
  label: string;
  timestamp: number;
  document: ProjectDocument;
  editor: EditorRuntimeState;
  assetPayloads: Map<ID, Uint8Array>;
}

export interface HistoryState {
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  maxSteps: number;
}
