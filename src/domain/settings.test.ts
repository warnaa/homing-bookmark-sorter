import { describe, expect, it } from "vitest";
import { isFolderInside, validateSettings } from "./settings.js";
import type { FolderSnapshot, Settings } from "./types.js";

const folderList: FolderSnapshot[] = [
  { id: "root", title: "root" },
  { id: "inbox", parentId: "root", title: "Inbox" },
  { id: "inbox-child", parentId: "inbox", title: "Inside" },
  { id: "destination", parentId: "root", title: "Development" },
  { id: "managed", parentId: "root", title: "Managed", unmodifiable: "managed" },
];
const folders = new Map(folderList.map((folder) => [folder.id, folder]));

function validSettings(): Settings {
  return {
    schemaVersion: 1,
    inboxFolderId: "inbox",
    confidenceThreshold: 80,
    rules: [
      {
        id: "rule",
        enabled: true,
        matchType: "exact_domain",
        pattern: "example.com",
        destinationFolderId: "destination",
        confidence: 100,
      },
    ],
  };
}

describe("folder relationships", () => {
  it("recognizes descendants without treating a folder as its own descendant", () => {
    expect(isFolderInside("inbox-child", "inbox", folders)).toBe(true);
    expect(isFolderInside("inbox", "inbox", folders)).toBe(false);
  });
});

describe("validateSettings", () => {
  it("accepts a valid configuration", () => {
    expect(validateSettings(validSettings(), folders)).toEqual([]);
  });

  it("rejects destinations inside the Inbox", () => {
    const settings = validSettings();
    settings.rules[0]!.destinationFolderId = "inbox-child";

    expect(validateSettings(settings, folders).map(({ code }) => code)).toEqual([
      "rule_destination_inside_inbox",
    ]);
  });

  it("needs only an Inbox, not a Needs review folder", () => {
    const settings = validSettings();
    settings.inboxFolderId = "";

    expect(validateSettings(settings, folders).map(({ code }) => code)).toEqual([
      "inbox_required",
    ]);
  });

  it("rejects missing and managed destinations", () => {
    const settings = validSettings();
    settings.rules.push({
      ...settings.rules[0]!,
      id: "missing",
      destinationFolderId: "gone",
    });
    settings.rules.push({
      ...settings.rules[0]!,
      id: "managed",
      destinationFolderId: "managed",
    });

    expect(validateSettings(settings, folders).map(({ code }) => code)).toEqual([
      "rule_destination_missing",
      "rule_destination_unwritable",
    ]);
  });
});
