import { describe, expect, it } from "vitest";
import type { BrowserGateway } from "../browser/api.js";
import {
  createDefaultSettings,
  type ActivityRecord,
  type BookmarkSnapshot,
  type ProblemRecord,
  type Settings,
  type SuppressedArrival,
  type WorkAttempt,
} from "../domain/types.js";
import type { StateRepository } from "../storage/repository.js";
import { SortingCoordinator } from "./coordinator.js";

class MemoryRepository implements StateRepository {
  settings: Settings = createDefaultSettings();
  attempts = new Map<string, WorkAttempt>();
  activity: ActivityRecord[] = [];
  problems: ProblemRecord[] = [];
  suppressions = new Map<string, SuppressedArrival>();
  importInProgress = false;

  async getSettings() { return structuredClone(this.settings); }
  async saveSettings(settings: Settings) { this.settings = structuredClone(settings); }
  async getAttempt(id: string) { return structuredClone(this.attempts.get(id)); }
  async getAttempts() { return structuredClone([...this.attempts.values()]); }
  async putAttempt(attempt: WorkAttempt) { this.attempts.set(attempt.bookmarkId, structuredClone(attempt)); }
  async removeAttempt(id: string) { this.attempts.delete(id); }
  async getActivity() { return structuredClone(this.activity); }
  async addActivity(record: ActivityRecord) { this.activity.unshift(structuredClone(record)); }
  async updateActivity(record: ActivityRecord) {
    this.activity = this.activity.map((entry) => entry.id === record.id ? structuredClone(record) : entry);
  }
  async clearActivity() { this.activity = []; }
  async getProblems() { return structuredClone(this.problems); }
  async addProblem(problem: ProblemRecord) { this.problems.unshift(structuredClone(problem)); }
  async clearProblems() { this.problems = []; }
  async putSuppression(suppression: SuppressedArrival) { this.suppressions.set(suppression.bookmarkId, structuredClone(suppression)); }
  async consumeSuppression(bookmarkId: string, parentId: string) {
    const suppression = this.suppressions.get(bookmarkId);
    this.suppressions.delete(bookmarkId);
    return suppression?.parentId === parentId && suppression.expiresAt > Date.now();
  }
  async getImportInProgress() { return this.importInProgress; }
  async setImportInProgress(value: boolean) { this.importInProgress = value; }
}

class FakeBrowser implements BrowserGateway {
  nodes = new Map<string, BookmarkSnapshot>();
  moves: Array<{ id: string; parentId: string }> = [];
  marked: string[] = [];
  events: string[] = [];
  badge = "";
  getBookmarkHook?: (id: string, call: number) => void;
  getFolderError?: Error;
  moveError?: Error;
  markError?: Error;
  private getCalls = 0;

  async getBookmark(id: string) {
    this.getCalls += 1;
    this.getBookmarkHook?.(id, this.getCalls);
    return structuredClone(this.nodes.get(id));
  }
  async getFolder(id: string) {
    if (this.getFolderError) throw this.getFolderError;
    const node = this.nodes.get(id);
    return node && !node.url ? structuredClone(node) : undefined;
  }
  async getChildren(id: string) {
    return structuredClone([...this.nodes.values()].filter((node) => node.parentId === id));
  }
  async moveBookmark(id: string, parentId: string) {
    const node = this.nodes.get(id);
    if (!node) throw new Error("missing");
    if (this.moveError) throw this.moveError;
    node.parentId = parentId;
    this.moves.push({ id, parentId });
    this.events.push(`move:${id}`);
    return structuredClone(node);
  }
  async markFolderModified(folderId: string) {
    if (this.markError) throw this.markError;
    this.marked.push(folderId);
    this.events.push(`mark:${folderId}`);
  }
  async setBadge(text: string) { this.badge = text; }
}

function fixture() {
  const repository = new MemoryRepository();
  repository.settings = {
    schemaVersion: 1,
    inboxFolderId: "inbox",
    confidenceThreshold: 80,
    rules: [
      {
        id: "development-rule",
        enabled: true,
        matchType: "domain_suffix",
        pattern: "example.com",
        destinationFolderId: "development",
        confidence: 95,
      },
    ],
  };
  const browser = new FakeBrowser();
  browser.nodes.set("root", { id: "root", title: "root" });
  browser.nodes.set("inbox", { id: "inbox", parentId: "root", title: "Inbox" });
  browser.nodes.set("development", { id: "development", parentId: "root", title: "Development" });
  browser.nodes.set("manual", { id: "manual", parentId: "root", title: "Manual" });
  const bookmark: BookmarkSnapshot = {
    id: "bookmark",
    parentId: "inbox",
    title: "Example article",
    url: "https://docs.example.com/article",
  };
  browser.nodes.set(bookmark.id, bookmark);
  let id = 0;
  const coordinator = new SortingCoordinator(
    browser,
    repository,
    () => 1_000,
    () => `id-${++id}`,
  );
  return { browser, repository, coordinator, bookmark };
}

describe("SortingCoordinator", () => {
  it("moves a confident Inbox match to its arbitrary destination", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();

    await coordinator.handleArrival(bookmark);

    expect(browser.moves).toEqual([{ id: "bookmark", parentId: "development" }]);
    expect(repository.activity[0]).toMatchObject({
      outcome: "moved",
      toFolderId: "development",
      ruleId: "development-rule",
    });
    expect(repository.attempts.size).toBe(0);
  });

  it("makes the Inbox the default save folder again after a move", async () => {
    const { browser, coordinator, bookmark } = fixture();

    await coordinator.handleArrival(bookmark);

    expect(browser.events).toEqual(["move:bookmark", "mark:inbox"]);
  });

  it("keeps a completed move when the Inbox cannot be marked", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    browser.markError = new Error("rejected");

    await coordinator.handleArrival(bookmark);

    expect(browser.moves).toEqual([{ id: "bookmark", parentId: "development" }]);
    expect(repository.activity).toHaveLength(1);
    expect(repository.activity[0]).toMatchObject({ outcome: "moved" });
    expect(repository.problems).toEqual([]);
  });

  it("leaves an unmatched bookmark in the Inbox", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    bookmark.url = "https://unmatched.test/article";
    browser.nodes.set(bookmark.id, bookmark);

    await coordinator.handleArrival(bookmark);

    expect(browser.moves).toEqual([]);
    expect(browser.marked).toEqual([]);
    expect(browser.nodes.get("bookmark")!.parentId).toBe("inbox");
    expect(repository.activity[0]).toMatchObject({
      outcome: "unsorted",
      fromFolderId: "inbox",
      reasonCode: "no_rule_match",
    });
    expect(repository.activity[0]!.toFolderId).toBeUndefined();
    expect(repository.attempts.size).toBe(0);
    expect(repository.problems).toEqual([]);
  });

  it("leaves a below-threshold match in the Inbox and names the rule", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    repository.settings.confidenceThreshold = 99;

    await coordinator.handleArrival(bookmark);

    expect(browser.moves).toEqual([]);
    expect(repository.activity[0]).toMatchObject({
      outcome: "unsorted",
      reasonCode: "below_threshold",
      ruleId: "development-rule",
      confidence: 95,
    });
  });

  it("leaves a bookmark in the Inbox when the browser rejects the move", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    browser.moveError = new Error("rejected");

    await coordinator.handleArrival(bookmark);

    expect(browser.nodes.get("bookmark")!.parentId).toBe("inbox");
    expect(browser.marked).toEqual([]);
    expect(repository.activity[0]).toMatchObject({
      outcome: "failed",
      reasonCode: "move_failed",
    });
    expect(repository.problems[0]).toMatchObject({ code: "move_failed" });
    expect(repository.attempts.size).toBe(0);
    expect(browser.badge).toBe("1");
  });

  it("leaves a bookmark in the Inbox after a processing error", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    browser.getFolderError = new Error("unexpected");

    await coordinator.handleArrival(bookmark);

    expect(browser.moves).toEqual([]);
    expect(repository.activity[0]).toMatchObject({
      outcome: "failed",
      reasonCode: "processing_failed",
    });
    expect(repository.problems[0]).toMatchObject({ code: "processing_failed" });
    expect(repository.attempts.size).toBe(0);
  });

  it("does not treat reordering inside the Inbox as an arrival", async () => {
    const { browser, repository, coordinator } = fixture();

    coordinator.handleMoved("bookmark", "inbox", "inbox");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(browser.moves).toEqual([]);
    expect(repository.activity).toEqual([]);
  });

  it("sorts a bookmark moved into the Inbox from another folder", async () => {
    const { browser, coordinator } = fixture();

    coordinator.handleMoved("bookmark", "inbox", "manual");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(browser.moves).toEqual([{ id: "bookmark", parentId: "development" }]);
  });

  it("does not touch bookmarks outside the configured Inbox", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    bookmark.parentId = "manual";

    await coordinator.handleArrival(bookmark);

    expect(browser.moves).toEqual([]);
    expect(repository.activity).toEqual([]);
  });

  it("does not classify arrivals while an import is in progress", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    await coordinator.setImportInProgress(true);

    await coordinator.handleArrival(bookmark);

    expect(repository.importInProgress).toBe(true);
    expect(browser.moves).toEqual([]);
  });

  it("lets a later manual move win during processing", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    browser.getBookmarkHook = (id, call) => {
      if (id === bookmark.id && call === 2) browser.nodes.get(id)!.parentId = "manual";
    };

    await coordinator.handleArrival(bookmark);

    expect(browser.moves).toEqual([]);
    expect(repository.activity[0]).toMatchObject({
      outcome: "cancelled",
      reasonCode: "manual_move",
    });
  });

  it("reconciles a move completed before a worker restart", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    bookmark.parentId = "development";
    browser.nodes.set(bookmark.id, bookmark);
    repository.attempts.set(bookmark.id, {
      bookmarkId: bookmark.id,
      observedParentId: "inbox",
      observedUrl: bookmark.url!,
      observedTitle: bookmark.title,
      observedAt: 500,
      state: "moving",
      attemptVersion: 1,
      targetFolderId: "development",
      plannedOutcome: "moved",
      reasonCode: "rule_match",
      ruleId: "development-rule",
      confidence: 95,
    });

    await coordinator.recoverPendingWork();

    expect(browser.moves).toEqual([]);
    expect(repository.activity[0]).toMatchObject({ outcome: "moved" });
    expect(repository.attempts.size).toBe(0);
  });

  it("leaves a bookmark in the Inbox when its rule destination is missing", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    browser.nodes.delete("development");

    await coordinator.handleArrival(bookmark);

    expect(browser.moves).toEqual([]);
    expect(browser.nodes.get("bookmark")!.parentId).toBe("inbox");
    expect(repository.activity[0]).toMatchObject({
      outcome: "failed",
      reasonCode: "destination_missing",
    });
    expect(repository.problems[0]).toMatchObject({
      code: "destination_missing",
    });
    expect(browser.badge).toBe("1");
  });

  it("reports deletion of a configured folder immediately", async () => {
    const { browser, repository, coordinator } = fixture();

    await coordinator.handleRemoved("development");

    expect(repository.problems[0]).toMatchObject({
      code: "destination_missing",
      folderId: "development",
    });
    expect(browser.badge).toBe("1");
  });

  it("undoes only a still-current confident move", async () => {
    const { browser, repository, coordinator, bookmark } = fixture();
    await coordinator.handleArrival(bookmark);
    const activity = repository.activity[0]!;

    const response = await coordinator.undoMove(activity.id);

    expect(response).toEqual({ ok: true });
    expect(browser.moves.at(-1)).toEqual({ id: "bookmark", parentId: "inbox" });
    expect(repository.activity[0]!.undoneAt).toBe(1_000);
    expect(repository.suppressions.get("bookmark")).toMatchObject({
      parentId: "inbox",
    });
  });
});
