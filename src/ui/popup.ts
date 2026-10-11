import { UNDO_WINDOW_MS } from "../domain/types.js";
import type { ActivityRecord, ProblemRecord } from "../domain/types.js";
import type {
  PopupState,
  RuntimeRequest,
  RuntimeResponse,
} from "../shared/messages.js";
import { loadFolderChoices } from "./folders.js";
import { localizeDocument, message } from "./i18n.js";
import { formatActivityTime } from "./format.js";
import { domainFromUrl } from "./rule-input.js";

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

interface FolderNames {
  paths: Map<string, string>;
  titles: Map<string, string>;
}

type ActivityStatus = "moved" | "review" | "failed" | "cancelled" | "undone";

const STATUS_ICONS: Record<ActivityStatus, string> = {
  moved: "✓",
  review: "?",
  failed: "!",
  cancelled: "↷",
  undone: "↶",
};

function activityStatus(record: ActivityRecord): ActivityStatus {
  return record.outcome === "moved" && record.undoneAt ? "undone" : record.outcome;
}

function folderPath(id: string | undefined, folders: FolderNames): string {
  return (id && folders.paths.get(id)) || message("unknownFolderLabel");
}

function activitySummary(record: ActivityRecord, folders: FolderNames): string {
  switch (activityStatus(record)) {
    case "moved":
      return message("activityMoved", folderPath(record.toFolderId, folders));
    case "undone":
      return message("activityUndone");
    case "review":
      return message("activityNeedsReview", folderPath(record.toFolderId, folders));
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

/** A few words shown on the card; the full sentence stays in the tooltip. */
function shortReason(record: ActivityRecord): string | undefined {
  switch (record.reasonCode) {
    case "rule_match":
      return undefined;
    case "below_threshold":
      return message("reasonShortBelowThreshold", String(record.confidence ?? 0));
    case "no_rule_match":
      return message("reasonShortNoRule");
    case "manual_move":
      return message("reasonShortManualMove");
    default:
      return reasonText(record);
  }
}

function chip(text: string, className: string, title?: string): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = `chip ${className}`;
  element.textContent = text;
  if (title) element.title = title;
  return element;
}

function renderActivity(activity: ActivityRecord[], folders: FolderNames): void {
  activityList.replaceChildren();
  activityEmpty.hidden = activity.length > 0;
  const locale = chrome.i18n.getUILanguage();
  const fullTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const now = Date.now();

  for (const record of activity) {
    const status = activityStatus(record);
    const summary = activitySummary(record, folders);
    const reason = reasonText(record);

    const item = document.createElement("li");
    item.className = `activity-item activity-item--${status}`;
    item.title = `${summary}
${reason}
${fullTime.format(record.occurredAt)}`;

    const icon = document.createElement("span");
    icon.className = "status-icon";
    icon.textContent = STATUS_ICONS[status];
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", summary);

    const body = document.createElement("div");
    body.className = "activity-item__body";

    const header = document.createElement("div");
    header.className = "activity-item__header";
    const title = document.createElement("p");
    title.className = "activity-item__title";
    title.textContent = record.bookmarkTitle || message("untitledBookmarkLabel");
    const time = document.createElement("time");
    time.className = "activity-item__time";
    time.dateTime = new Date(record.occurredAt).toISOString();
    time.textContent = formatActivityTime(record.occurredAt, now, locale);
    header.append(title, time);

    const meta = document.createElement("div");
    meta.className = "activity-item__meta";
    if ((status === "moved" || status === "review") && record.toFolderId) {
      const path = folderPath(record.toFolderId, folders);
      const name = folders.titles.get(record.toFolderId) || path;
      meta.append(chip(`→ ${name}`, "chip--folder", path));
    }
    if (record.reasonCode === "rule_match" && record.confidence !== undefined) {
      meta.append(chip(`${record.confidence}%`, "chip--muted", reason));
    }
    const short = status === "undone" ? summary : shortReason(record);
    if (short) meta.append(chip(short, "chip--reason", reason));

    const actions = document.createElement("span");
    actions.className = "activity-item__actions";
    if (record.outcome === "review") {
      actions.append(createRuleButton(record));
    }

    const canUndo =
      status === "moved" &&
      record.undoExpiresAt !== undefined &&
      record.undoExpiresAt > now &&
      record.undoExpiresAt - record.occurredAt <= UNDO_WINDOW_MS;
    if (canUndo) {
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
          meta.replaceChildren(
            chip(message(`error_${response.errorCode}`), "chip--reason"),
          );
        } else {
          await load();
        }
      });
      actions.append(undo);
    }
    if (actions.childElementCount) meta.append(actions);

    body.append(header, meta);
    item.append(icon, body);
    activityList.append(item);
  }
}

function createRuleButton(record: ActivityRecord): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "text-button";
  button.textContent = message("createRuleButton");
  button.addEventListener("click", async () => {
    const [bookmark] = await chrome.bookmarks
      .get(record.bookmarkId)
      .catch(() => []);
    const pattern = bookmark?.url ? domainFromUrl(bookmark.url) : undefined;
    const url = new URL(chrome.runtime.getURL("options.html"));
    if (pattern) url.searchParams.set("pattern", pattern);
    await chrome.tabs.create({ url: url.href });
    window.close();
  });
  return button;
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
  const names: FolderNames = {
    paths: new Map(folders.map((folder) => [folder.id, folder.path])),
    titles: new Map(folders.map((folder) => [folder.id, folder.title])),
  };
  setupPanel.hidden = Boolean(
    state.settings.inboxFolderId && state.settings.reviewFolderId,
  );
  renderProblems(state.problems);
  renderActivity(state.activity, names);
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
