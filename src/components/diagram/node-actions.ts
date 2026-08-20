import { createContext } from "react";

export interface NodeActions {
  onToggleCollapse: (nodeId: string) => void;
  onNoteChange: (noteId: string, text: string) => void;
  onNoteDelete: (noteId: string) => void;
}

export const NodeActionsContext = createContext<NodeActions>({
  onToggleCollapse: () => {},
  onNoteChange: () => {},
  onNoteDelete: () => {},
});
