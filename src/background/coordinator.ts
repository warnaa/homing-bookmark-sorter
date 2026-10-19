import type { BrowserGateway } from "../browser/api.js";
import { classifyBookmark } from "../domain/classifier.js";
import {
  UNDO_WINDOW_MS,
  type ActivityRecord,
  type BookmarkSnapshot,
  type ProblemRecord,
  type Settings,
  type WorkAttempt,
} from "../domain/types.js";
import type { RuntimeResponse } from "../shared/messages.js";
import type { StateRepository } from "../storage/repository.js";

type Clock = () => number;
type IdFactory = () => string;

export class SortingCoordinator {
  private readonly processing = new Set<string>();
  private readonly cancelled = new Set<string>();
  private readonly expectedMoves = new Map<string, string>();
  private importPaused = false;

  constructor(
    private readonly browser: BrowserGateway,
    private readonly repository: StateRepository,
    private readonly now: Clock = Date.now,
    private readonly createId: IdFactory = () => crypto.randomUUID(),
  ) {}

  async handleArrival(bookmark: BookmarkSnapshot): Promise<void> {
    const settings = await this.repository.getSettings();
    if (
      !bookmark.url ||
      !settings.inboxFolderId ||
      bookmark.parentId !== settings.inboxFolderId ||
      (this.importPaused || (await this.repository.getImportInProgress()))
    ) {
      return;
    }

    if (
      await this.repository.consumeSuppression(bookmark.id, settings.inboxFolderId)
    ) {
      return;
    }

    if (await this.repository.getAttempt(bookmark.id)) return;

    await this.repository.putAttempt({
      bookmarkId: bookmark.id,
      observedParentId: settings.inboxFolderId,
      observedUrl: bookmark.url,
      observedTitle: bookmark.title,
      observedAt: this.now(),
      state: "pending",
      attemptVersion: 1,
    });

    await this.processAttempt(bookmark.id);
  }

  handleMoved(bookmarkId: string, parentId: string, oldParentId?: string): void {
    const expectedParent = this.expectedMoves.get(bookmarkId);
    if (expectedParent === parentId) {
      this.expectedMoves.delete(bookmarkId);
      return;
    }
    // Reordering within one folder is neither an arrival nor a new placement.
    if (oldParentId === parentId) return;

    this.cancelled.add(bookmarkId);
    void this.reconcileExternalMove(bookmarkId, parentId);
  }

  async handleRemoved(nodeId: string): Promise<void> {
    this.cancelled.add(nodeId);
    await this.repository.removeAttempt(nodeId);

    const settings = await this.repository.getSettings();
    if (nodeId === settings.inboxFolderId) {
      await this.addProblem({ code: "inbox_missing", folderId: nodeId });
    }
    if (settings.rules.some((rule) => rule.destinationFolderId === nodeId)) {
      await this.addProblem({ code: "destination_missing", folderId: nodeId });
    }
    await this.updateBadge();
  }

  async setImportInProgress(value: boolean): Promise<void> {
    this.importPaused = value;
    await this.repository.setImportInProgress(value);
  }

  async recoverPendingWork(): Promise<void> {
    const attempts = await this.repository.getAttempts();
    await Promise.all(attempts.map((attempt) => this.processAttempt(attempt.bookmarkId)));
    await this.updateBadge();
  }

  async processExistingInboxBookmarks(): Promise<void> {
    const settings = await this.repository.getSettings();
    if (!settings.inboxFolderId) return;
    const children = await this.browser.getChildren(settings.inboxFolderId);
    for (const bookmark of children) {
      await this.handleArrival(bookmark);
    }
  }

  async undoMove(activityId: string): Promise<RuntimeResponse> {
    const activity = await this.repository.getActivity();
    const record = activity.find((entry) => entry.id === activityId);
    const settings = await this.repository.getSettings();

    if (
      !record ||
      record.outcome !== "moved" ||
      record.undoneAt !== undefined ||
      record.undoExpiresAt === undefined ||
      record.undoExpiresAt < this.now() ||
      !record.toFolderId ||
      !settings.inboxFolderId
    ) {
      return { ok: false, errorCode: "undo_unavailable" };
    }

    const [bookmark, inbox] = await Promise.all([
      this.browser.getBookmark(record.bookmarkId),
      this.browser.getFolder(settings.inboxFolderId),
    ]);
    if (
      !bookmark ||
      bookmark.parentId !== record.toFolderId ||
      !inbox ||
      inbox.unmodifiable
    ) {
      return { ok: false, errorCode: "undo_stale" };
    }

    await this.repository.putSuppression({
      bookmarkId: bookmark.id,
      parentId: settings.inboxFolderId,
      expiresAt: this.now() + 60_000,
    });
    await this.browser.moveBookmark(bookmark.id, settings.inboxFolderId);
    await this.repository.updateActivity({ ...record, undoneAt: this.now() });
    return { ok: true };
  }

  async clearActivity(): Promise<void> {
    await this.repository.clearActivity();
  }

  async clearProblems(): Promise<void> {
    await this.repository.clearProblems();
    await this.updateBadge();
  }

  async updateBadge(): Promise<void> {
    const count = (await this.repository.getProblems()).length;
    await this.browser.setBadge(count > 99 ? "99+" : count ? String(count) : "");
  }

  private async reconcileExternalMove(
    bookmarkId: string,
    parentId: string,
  ): Promise<void> {
    const [settings, attempt] = await Promise.all([
      this.repository.getSettings(),
      this.repository.getAttempt(bookmarkId),
    ]);

    if (attempt?.state === "moving" && attempt.targetFolderId === parentId) {
      this.cancelled.delete(bookmarkId);
      await this.finalizeAttempt(attempt);
      return;
    }

    if (attempt && parentId !== settings.inboxFolderId) {
      await this.cancelAttempt(attempt, "manual_move");
    }

    if (parentId === settings.inboxFolderId) {
      this.cancelled.delete(bookmarkId);
      const bookmark = await this.browser.getBookmark(bookmarkId);
      if (bookmark) await this.handleArrival(bookmark);
    }
  }

  private async processAttempt(bookmarkId: string): Promise<void> {
    if (this.processing.has(bookmarkId)) return;
    this.processing.add(bookmarkId);

    try {
      const attempt = await this.repository.getAttempt(bookmarkId);
      if (!attempt) return;
      if (attempt.state === "moving") {
        await this.reconcileMovingAttempt(attempt);
      } else {
        await this.classifyAndMove(attempt);
      }
    } catch {
      const attempt = await this.repository.getAttempt(bookmarkId);
      if (attempt) await this.routeTechnicalFailure(attempt, "processing_failed");
    } finally {
      this.processing.delete(bookmarkId);
      this.cancelled.delete(bookmarkId);
      await this.updateBadge();
    }
  }

  private async classifyAndMove(attempt: WorkAttempt): Promise<void> {
    const [settings, current] = await Promise.all([
      this.repository.getSettings(),
      this.browser.getBookmark(attempt.bookmarkId),
    ]);
    if (!current) {
      await this.repository.removeAttempt(attempt.bookmarkId);
      return;
    }
    if (
      current.parentId !== settings.inboxFolderId ||
      this.cancelled.has(attempt.bookmarkId)
    ) {
      await this.cancelAttempt(attempt, "manual_move");
      return;
    }

    const result = classifyBookmark(current, settings);
    if (result.kind === "match") {
      await this.planAndMove(
        attempt,
        settings,
        result.destinationFolderId,
        result.reasonCode,
        result.ruleId,
        result.confidence,
      );
      return;
    }

    await this.leaveInInbox(
      attempt,
      "unsorted",
      result.reasonCode,
      result.ruleId,
      result.confidence,
    );
  }

  private async planAndMove(
    attempt: WorkAttempt,
    settings: Settings,
    targetFolderId: string,
    reasonCode: string,
    ruleId: string,
    confidence: number,
  ): Promise<void> {
    const target = await this.browser.getFolder(targetFolderId);
    if (!target || target.unmodifiable) {
      await this.addProblem({
        code: "destination_missing",
        folderId: targetFolderId,
        bookmarkId: attempt.bookmarkId,
      });
      await this.leaveInInbox(attempt, "failed", "destination_missing", ruleId);
      return;
    }

    const movingAttempt: WorkAttempt = {
      ...attempt,
      state: "moving",
      targetFolderId,
      plannedOutcome: "moved",
      reasonCode,
      ruleId,
      confidence,
    };
    await this.repository.putAttempt(movingAttempt);

    const current = await this.browser.getBookmark(attempt.bookmarkId);
    if (
      !current ||
      current.parentId !== settings.inboxFolderId ||
      this.cancelled.has(attempt.bookmarkId)
    ) {
      await this.cancelAttempt(movingAttempt, "manual_move");
      return;
    }

    await this.executeMove(movingAttempt);
  }

  private async executeMove(attempt: WorkAttempt): Promise<void> {
    if (!attempt.targetFolderId || !attempt.plannedOutcome) return;
    this.expectedMoves.set(attempt.bookmarkId, attempt.targetFolderId);

    try {
      await this.browser.moveBookmark(attempt.bookmarkId, attempt.targetFolderId);
      await this.finalizeAttempt(attempt);
    } catch {
      this.expectedMoves.delete(attempt.bookmarkId);
      await this.addProblem({
        code: "move_failed",
        folderId: attempt.targetFolderId,
        bookmarkId: attempt.bookmarkId,
      });
      await this.leaveInInbox(attempt, "failed", "move_failed", attempt.ruleId);
    }
  }

  private async reconcileMovingAttempt(attempt: WorkAttempt): Promise<void> {
    const [settings, current] = await Promise.all([
      this.repository.getSettings(),
      this.browser.getBookmark(attempt.bookmarkId),
    ]);

    if (!current) {
      await this.repository.removeAttempt(attempt.bookmarkId);
      return;
    }
    if (current.parentId === attempt.targetFolderId) {
      await this.finalizeAttempt(attempt);
      return;
    }
    if (current.parentId !== settings.inboxFolderId) {
      await this.cancelAttempt(attempt, "manual_move");
      return;
    }

    await this.executeMove(attempt);
  }

  private async finalizeAttempt(attempt: WorkAttempt): Promise<void> {
    if (!attempt.plannedOutcome) return;
    const record: ActivityRecord = {
      id: this.createId(),
      bookmarkId: attempt.bookmarkId,
      bookmarkTitle: attempt.observedTitle,
      outcome: attempt.plannedOutcome,
      fromFolderId: attempt.observedParentId,
      toFolderId: attempt.targetFolderId,
      ruleId: attempt.ruleId,
      confidence: attempt.confidence,
      reasonCode: attempt.reasonCode ?? "completed",
      occurredAt: this.now(),
      undoExpiresAt: this.now() + UNDO_WINDOW_MS,
    };
    await this.repository.addActivity(record);
    await this.repository.removeAttempt(attempt.bookmarkId);

    // The move made the destination the browser's default folder for the next
    // saved bookmark; offer the Inbox there again. This is best effort.
    const { inboxFolderId } = await this.repository.getSettings();
    if (inboxFolderId) {
      await this.browser.markFolderModified(inboxFolderId).catch(() => undefined);
    }
  }

  private async cancelAttempt(
    attempt: WorkAttempt,
    reasonCode: string,
  ): Promise<void> {
    await this.repository.addActivity({
      id: this.createId(),
      bookmarkId: attempt.bookmarkId,
      bookmarkTitle: attempt.observedTitle,
      outcome: "cancelled",
      fromFolderId: attempt.observedParentId,
      reasonCode,
      occurredAt: this.now(),
    });
    await this.repository.removeAttempt(attempt.bookmarkId);
  }

  private async routeTechnicalFailure(
    attempt: WorkAttempt,
    reasonCode: string,
  ): Promise<void> {
    await this.addProblem({
      code: "processing_failed",
      bookmarkId: attempt.bookmarkId,
    });
    const settings = await this.repository.getSettings();
    const current = await this.browser.getBookmark(attempt.bookmarkId);
    if (!current || current.parentId !== settings.inboxFolderId) {
      await this.repository.removeAttempt(attempt.bookmarkId);
      return;
    }
    await this.leaveInInbox(attempt, "failed", reasonCode);
  }

  /** Ends an attempt without moving the bookmark, so it waits in the Inbox. */
  private async leaveInInbox(
    attempt: WorkAttempt,
    outcome: "unsorted" | "failed",
    reasonCode: string,
    ruleId?: string,
    confidence?: number,
  ): Promise<void> {
    await this.repository.addActivity({
      id: this.createId(),
      bookmarkId: attempt.bookmarkId,
      bookmarkTitle: attempt.observedTitle,
      outcome,
      fromFolderId: attempt.observedParentId,
      ruleId,
      confidence,
      reasonCode,
      occurredAt: this.now(),
    });
    await this.repository.removeAttempt(attempt.bookmarkId);
  }

  private async addProblem(
    problem: Omit<ProblemRecord, "id" | "occurredAt">,
  ): Promise<void> {
    await this.repository.addProblem({
      ...problem,
      id: this.createId(),
      occurredAt: this.now(),
    });
  }
}
