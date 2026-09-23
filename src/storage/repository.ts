import {
  ACTIVITY_LIMIT,
  createDefaultSettings,
  type ActivityRecord,
  type ProblemRecord,
  type Settings,
  type SuppressedArrival,
  type WorkAttempt,
} from "../domain/types.js";

const STORAGE_KEYS = {
  settings: "settings",
  attempts: "attempts",
  activity: "activity",
  problems: "problems",
  suppressions: "suppressions",
  importInProgress: "importInProgress",
} as const;

export interface StateRepository {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  getAttempt(bookmarkId: string): Promise<WorkAttempt | undefined>;
  getAttempts(): Promise<WorkAttempt[]>;
  putAttempt(attempt: WorkAttempt): Promise<void>;
  removeAttempt(bookmarkId: string): Promise<void>;
  getActivity(): Promise<ActivityRecord[]>;
  addActivity(record: ActivityRecord): Promise<void>;
  updateActivity(record: ActivityRecord): Promise<void>;
  clearActivity(): Promise<void>;
  getProblems(): Promise<ProblemRecord[]>;
  addProblem(problem: ProblemRecord): Promise<void>;
  clearProblems(): Promise<void>;
  putSuppression(suppression: SuppressedArrival): Promise<void>;
  consumeSuppression(bookmarkId: string, parentId: string): Promise<boolean>;
  getImportInProgress(): Promise<boolean>;
  setImportInProgress(value: boolean): Promise<void>;
}

function migrateSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return createDefaultSettings();
  const candidate = value as Partial<Settings>;
  if (candidate.schemaVersion !== 1) return createDefaultSettings();
  return {
    ...createDefaultSettings(),
    ...candidate,
    rules: Array.isArray(candidate.rules) ? candidate.rules : [],
  };
}

export class ChromeStateRepository implements StateRepository {
  private mutationQueue: Promise<void> = Promise.resolve();

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async getSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
    return migrateSettings(result[STORAGE_KEYS.settings]);
  }

  async saveSettings(settings: Settings): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
  }

  async getAttempt(bookmarkId: string): Promise<WorkAttempt | undefined> {
    const attempts = await this.getAttemptMap();
    return attempts[bookmarkId];
  }

  async getAttempts(): Promise<WorkAttempt[]> {
    return Object.values(await this.getAttemptMap());
  }

  async putAttempt(attempt: WorkAttempt): Promise<void> {
    await this.runExclusive(async () => {
      const attempts = await this.getAttemptMap();
      attempts[attempt.bookmarkId] = attempt;
      await chrome.storage.local.set({ [STORAGE_KEYS.attempts]: attempts });
    });
  }

  async removeAttempt(bookmarkId: string): Promise<void> {
    await this.runExclusive(async () => {
      const attempts = await this.getAttemptMap();
      if (!(bookmarkId in attempts)) return;
      delete attempts[bookmarkId];
      await chrome.storage.local.set({ [STORAGE_KEYS.attempts]: attempts });
    });
  }

  async getActivity(): Promise<ActivityRecord[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.activity);
    const value = result[STORAGE_KEYS.activity];
    return Array.isArray(value) ? (value as ActivityRecord[]) : [];
  }

  async addActivity(record: ActivityRecord): Promise<void> {
    await this.runExclusive(async () => {
      const activity = await this.getActivity();
      await chrome.storage.local.set({
        [STORAGE_KEYS.activity]: [record, ...activity].slice(0, ACTIVITY_LIMIT),
      });
    });
  }

  async updateActivity(record: ActivityRecord): Promise<void> {
    await this.runExclusive(async () => {
      const activity = await this.getActivity();
      const next = activity.map((entry) =>
        entry.id === record.id ? record : entry,
      );
      await chrome.storage.local.set({ [STORAGE_KEYS.activity]: next });
    });
  }

  async clearActivity(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.activity]: [] });
  }

  async getProblems(): Promise<ProblemRecord[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.problems);
    const value = result[STORAGE_KEYS.problems];
    return Array.isArray(value) ? (value as ProblemRecord[]) : [];
  }

  async addProblem(problem: ProblemRecord): Promise<void> {
    await this.runExclusive(async () => {
      const problems = await this.getProblems();
      const duplicate = problems.some(
        (entry) =>
          entry.code === problem.code &&
          entry.folderId === problem.folderId &&
          entry.bookmarkId === problem.bookmarkId,
      );
      if (duplicate) return;
      await chrome.storage.local.set({
        [STORAGE_KEYS.problems]: [problem, ...problems].slice(0, 50),
      });
    });
  }

  async clearProblems(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.problems]: [] });
  }

  async putSuppression(suppression: SuppressedArrival): Promise<void> {
    await this.runExclusive(async () => {
      const suppressions = await this.getSuppressionMap();
      suppressions[suppression.bookmarkId] = suppression;
      await chrome.storage.local.set({
        [STORAGE_KEYS.suppressions]: suppressions,
      });
    });
  }

  async consumeSuppression(
    bookmarkId: string,
    parentId: string,
  ): Promise<boolean> {
    return this.runExclusive(async () => {
      const suppressions = await this.getSuppressionMap();
      const suppression = suppressions[bookmarkId];
      const isMatch =
        suppression?.parentId === parentId && suppression.expiresAt > Date.now();

      if (suppression) {
        delete suppressions[bookmarkId];
        await chrome.storage.local.set({
          [STORAGE_KEYS.suppressions]: suppressions,
        });
      }

      return isMatch;
    });
  }

  async getImportInProgress(): Promise<boolean> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.importInProgress);
    return result[STORAGE_KEYS.importInProgress] === true;
  }

  async setImportInProgress(value: boolean): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.importInProgress]: value });
  }

  private async getAttemptMap(): Promise<Record<string, WorkAttempt>> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.attempts);
    const value = result[STORAGE_KEYS.attempts];
    return value && typeof value === "object"
      ? (value as Record<string, WorkAttempt>)
      : {};
  }

  private async getSuppressionMap(): Promise<Record<string, SuppressedArrival>> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.suppressions);
    const value = result[STORAGE_KEYS.suppressions];
    return value && typeof value === "object"
      ? (value as Record<string, SuppressedArrival>)
      : {};
  }
}
