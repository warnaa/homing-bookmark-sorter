import { describe, expect, it } from "vitest";
import { classifyBookmark } from "./classifier.js";
import type { BookmarkSnapshot, Rule, Settings } from "./types.js";

const bookmark: BookmarkSnapshot = {
  id: "bookmark-1",
  parentId: "inbox",
  title: "TypeScript handbook",
  url: "https://docs.example.com/guide/typescript?source=test",
};

function rule(overrides: Partial<Rule>): Rule {
  return {
    id: "rule-1",
    enabled: true,
    matchType: "exact_domain",
    pattern: "docs.example.com",
    destinationFolderId: "destination",
    confidence: 100,
    ...overrides,
  };
}

function settings(rules: Rule[], threshold = 80): Settings {
  return {
    schemaVersion: 1,
    inboxFolderId: "inbox",
    reviewFolderId: "review",
    confidenceThreshold: threshold,
    rules,
  };
}

describe("classifyBookmark", () => {
  it.each([
    ["exact_domain", "docs.example.com"],
    ["domain_suffix", "example.com"],
    ["url_pattern", "https://*.example.com/guide/*"],
    ["title_keyword", "typescript"],
  ] as const)("matches a %s rule", (matchType, pattern) => {
    const result = classifyBookmark(
      bookmark,
      settings([rule({ matchType, pattern })]),
    );

    expect(result).toMatchObject({
      kind: "match",
      destinationFolderId: "destination",
      matchType,
    });
  });

  it("does not let a domain suffix match a deceptive hostname", () => {
    const result = classifyBookmark(
      { ...bookmark, url: "https://notexample.com/" },
      settings([rule({ matchType: "domain_suffix", pattern: "example.com" })]),
    );

    expect(result).toEqual({ kind: "unresolved", reasonCode: "no_rule_match" });
  });

  it("uses the first matching rule even when it is below threshold", () => {
    const result = classifyBookmark(
      bookmark,
      settings([
        rule({ id: "first", confidence: 60 }),
        rule({ id: "second", confidence: 100 }),
      ]),
    );

    expect(result).toMatchObject({
      kind: "unresolved",
      reasonCode: "below_threshold",
      ruleId: "first",
    });
  });

  it("skips disabled and empty rules", () => {
    const result = classifyBookmark(
      bookmark,
      settings([
        rule({ enabled: false }),
        rule({ id: "empty", pattern: "" }),
      ]),
    );

    expect(result).toEqual({ kind: "unresolved", reasonCode: "no_rule_match" });
  });
});
