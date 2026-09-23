import { UNDO_WINDOW_MS } from "../domain/types.js";
import type { ActivityRecord, ProblemRecord } from "../domain/types.js";
import type {
  PopupState,
  RuntimeRequest,
  RuntimeResponse,
} from "../shared/messages.js";
import { loadFolderChoices } from "./folders.js";
import { localizeDocument, message } from "./i18n.js";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: ${id}`);
  return element as T;
}

const activityList = requiredElement<HTMLOListElement>("activity-list");
const activityEmpty = requiredElement<HTMLElement>("activity-empty");
const problemsSection = requiredElement<HTMLElement>("problems-section");
const problemsList = requiredElement<HTMLUListElement>("problems-list");
const setupPanel = requiredElement<HTMLElement>("setup-panel");

function sendRequest(request: RuntimeRequest): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(request) as Promise<RuntimeResponse>;
}

function folderName(id: string | undefined, paths: Map<string, string>): string {
  return (id && paths.get(id)) || message("unknownFolderLabel");
}

function activitySummary(
  record: ActivityRecord,
  paths: Map<string, string>,
): string {
  switch (record.outcome) {
    case "moved":
      return record.undoneAt
        ? message("activityUndone")
        : message("activityMoved", folderName(record.toFolderId, paths));
    case "review":
      return message("activityNeedsReview", folderName(record.toFolderId, paths));
    case "failed":
      return message("activityFailed");
    case "cancelled":
      return message("activityCancelled");
  }
}

function reasonText(record: ActivityRecord): string {
  switch (record.reasonCode) {
    case "rule_match":
      return message("reasonRuleMatch", String(record.confidence ?? 0));
    case "below_threshold":
      return message("reasonBelowThreshold", String(record.confidence ?? 0));
    case "no_rule_match":
      return message("reasonNoRuleMatch");
    case "destination_missing":
      return message("reasonDestinationMissing");
    case "review_missing":
      return message("reasonReviewMissing");
    case "move_failed":
      return message("reasonMoveFailed");
    case "processing_failed":
      return message("reasonProcessingFailed");
    case "manual_move":
      return message("reasonManualMove");
    default:
      return message("reasonCompleted");
  }
}

function renderActivity(
  activity: ActivityRecord[],
  paths: Map<string, string>,
): void {
  activityList.replaceChildren();
  activityEmpty.hidden = activity.length > 0;
  const formatter = new Intl.DateTimeFormat(chrome.i18n.getUILanguage(), {
    dateStyle: "medium",
    timeStyle: "short",
  });

  for (const record of activity) {
    const item = document.createElement("li");
    item.className = "activity-item";
    const title = document.createElement("p");
    title.className = "activity-item__title";
    title.textContent = record.bookmarkTitle || message("untitledBookmarkLabel");
    const summary = document.createElement("div");
    summary.className = "activity-item__meta";
    summary.textContent = `${activitySummary(record, paths)} · ${reasonText(record)} · ${formatter.format(record.occurredAt)}`;
    item.append(title, summary);

    const canUndo =
      record.outcome === "moved" &&
      !record.undoneAt &&
      record.undoExpiresAt !== undefined &&
      record.undoExpiresAt > Date.now() &&
      record.undoExpiresAt - record.occurredAt <= UNDO_WINDOW_MS;
    if (canUndo) {
      const actions = document.createElement("div");
      actions.className = "activity-item__actions";
      const undo = document.createElement("button");
      undo.type = "button";
      undo.className = "text-button";
      undo.textContent = message("undoButton");
      undo.addEventListener("click", async () => {
        undo.disabled = true;
        const response = await sendRequest({
          type: "UNDO_MOVE",
          activityId: record.id,
        });
        if (!response.ok) {
          summary.textContent = message(`error_${response.errorCode}`);
        } else {
          await load();
        }
      });
      actions.append(undo);
      item.append(actions);
    }
    activityList.append(item);
  }
}

function problemText(problem: ProblemRecord): string {
  return message(`problem_${problem.code}`);
}

function renderProblems(problems: ProblemRecord[]): void {
  problemsSection.hidden = problems.length === 0;
  problemsList.replaceChildren();
  for (const problem of problems) {
    const item = document.createElement("li");
    item.className = "problem-item";
    item.textContent = problemText(problem);
    problemsList.append(item);
  }
}

async function getState(): Promise<PopupState> {
  const response = await sendRequest({ type: "GET_POPUP_STATE" });
  if (!response.ok || !response.state) throw new Error("state_unavailable");
  return response.state;
}

async function load(): Promise<void> {
  const [state, folders] = await Promise.all([getState(), loadFolderChoices()]);
  const paths = new Map(folders.map((folder) => [folder.id, folder.path]));
  setupPanel.hidden = Boolean(
    state.settings.inboxFolderId && state.settings.reviewFolderId,
  );
  renderProblems(state.problems);
  renderActivity(state.activity, paths);
}

function openOptions(): void {
  void chrome.runtime.openOptionsPage();
}

localizeDocument();
requiredElement("open-options").addEventListener("click", openOptions);
requiredElement("open-options-setup").addEventListener("click", openOptions);
requiredElement("clear-activity").addEventListener("click", async () => {
  await sendRequest({ type: "CLEAR_ACTIVITY" });
  await load();
});
requiredElement("clear-problems").addEventListener("click", async () => {
  await sendRequest({ type: "CLEAR_PROBLEMS" });
  await load();
});

void load().catch(() => {
  activityEmpty.hidden = false;
  activityEmpty.textContent = message("popupLoadError");
});
