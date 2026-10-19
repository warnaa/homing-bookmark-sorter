import { describe, expect, it } from "vitest";
import { createDefaultSettings } from "../domain/types.js";
import { migrateSettings } from "./repository.js";

describe("migrateSettings", () => {
  it("drops the Needs review folder from older settings", () => {
    const migrated = migrateSettings({
      schemaVersion: 1,
      inboxFolderId: "inbox",
      reviewFolderId: "review",
      confidenceThreshold: 70,
      rules: [],
    });

    expect(migrated).toEqual({
      ...createDefaultSettings(),
      inboxFolderId: "inbox",
      confidenceThreshold: 70,
    });
    expect(migrated).not.toHaveProperty("reviewFolderId");
  });

  it("falls back to defaults for unknown values", () => {
    expect(migrateSettings(undefined)).toEqual(createDefaultSettings());
    expect(migrateSettings({ schemaVersion: 2 })).toEqual(createDefaultSettings());
  });
});
