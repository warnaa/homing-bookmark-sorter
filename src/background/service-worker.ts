import {
  ChromeBrowserGateway,
  toBookmarkSnapshot,
} from "../browser/api.js";
import type { RuntimeRequest, RuntimeResponse } from "../shared/messages.js";
import { ChromeStateRepository } from "../storage/repository.js";
import { SortingCoordinator } from "./coordinator.js";

const RECOVERY_ALARM = "recover-pending-work";
const browserGateway = new ChromeBrowserGateway();
const repository = new ChromeStateRepository();
const coordinator = new SortingCoordinator(browserGateway, repository);

async function ensureRecoveryAlarm(): Promise<void> {
  const alarm = await chrome.alarms.get(RECOVERY_ALARM);
  if (!alarm) {
    await chrome.alarms.create(RECOVERY_ALARM, { periodInMinutes: 1 });
  }
}

async function bootstrap(): Promise<void> {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await ensureRecoveryAlarm();
  await coordinator.recoverPendingWork();
}

chrome.bookmarks.onCreated.addListener((_id, node) => {
  void coordinator.handleArrival(toBookmarkSnapshot(node));
});

chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
  coordinator.handleMoved(id, moveInfo.parentId);
});

chrome.bookmarks.onRemoved.addListener((id) => {
  void coordinator.handleRemoved(id);
});

chrome.bookmarks.onImportBegan.addListener(() => {
  void coordinator.setImportInProgress(true);
});

chrome.bookmarks.onImportEnded.addListener(() => {
  void coordinator.setImportInProgress(false);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECOVERY_ALARM) {
    void coordinator.recoverPendingWork();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void bootstrap();
});

chrome.runtime.onStartup.addListener(() => {
  void bootstrap();
});

chrome.runtime.onMessage.addListener(
  (
    message: RuntimeRequest,
    _sender,
    sendResponse: (response: RuntimeResponse) => void,
  ) => {
    const respond = async (): Promise<RuntimeResponse> => {
      switch (message.type) {
        case "GET_POPUP_STATE":
          return {
            ok: true,
            state: {
              settings: await repository.getSettings(),
              activity: await repository.getActivity(),
              problems: await repository.getProblems(),
            },
          };
        case "SETTINGS_UPDATED":
          await coordinator.updateBadge();
          return { ok: true };
        case "PROCESS_EXISTING":
          await coordinator.processExistingInboxBookmarks();
          return { ok: true };
        case "UNDO_MOVE":
          return coordinator.undoMove(message.activityId);
        case "CLEAR_ACTIVITY":
          await coordinator.clearActivity();
          return { ok: true };
        case "CLEAR_PROBLEMS":
          await coordinator.clearProblems();
          return { ok: true };
      }
    };

    void respond()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, errorCode: "unexpected_error" }));
    return true;
  },
);

void bootstrap();
