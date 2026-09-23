import type {
  ActivityRecord,
  ProblemRecord,
  Settings,
} from "../domain/types.js";

export type RuntimeRequest =
  | { type: "GET_POPUP_STATE" }
  | { type: "SETTINGS_UPDATED" }
  | { type: "PROCESS_EXISTING" }
  | { type: "UNDO_MOVE"; activityId: string }
  | { type: "CLEAR_ACTIVITY" }
  | { type: "CLEAR_PROBLEMS" };

export interface PopupState {
  settings: Settings;
  activity: ActivityRecord[];
  problems: ProblemRecord[];
}

export type RuntimeResponse =
  | { ok: true; state?: PopupState }
  | { ok: false; errorCode: string };
