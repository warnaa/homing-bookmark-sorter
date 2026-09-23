import type {
  BookmarkSnapshot,
  ClassificationResult,
  Rule,
  RuleMatchType,
  Settings,
} from "./types.js";

function normalizedDomain(value: string): string {
  const trimmed = value.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (trimmed.includes("://")) {
    try {
      return new URL(trimmed).hostname.toLowerCase().replace(/\.$/, "");
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function urlPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function matchesRule(
  rule: Rule,
  bookmark: BookmarkSnapshot,
  hostname: string | undefined,
): boolean {
  const pattern = rule.pattern.trim();
  if (!pattern) return false;

  switch (rule.matchType) {
    case "exact_domain":
      return hostname === normalizedDomain(pattern);
    case "domain_suffix": {
      const suffix = normalizedDomain(pattern);
      return hostname === suffix || hostname?.endsWith(`.${suffix}`) === true;
    }
    case "url_pattern":
      return bookmark.url
        ? urlPatternToRegExp(pattern).test(bookmark.url)
        : false;
    case "title_keyword":
      return bookmark.title.toLocaleLowerCase().includes(pattern.toLocaleLowerCase());
  }
}

function getHostname(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
    return hostname || undefined;
  } catch {
    return undefined;
  }
}

export function classifyBookmark(
  bookmark: BookmarkSnapshot,
  settings: Pick<Settings, "confidenceThreshold" | "rules">,
): ClassificationResult {
  const hostname = getHostname(bookmark.url);

  for (const rule of settings.rules) {
    if (!rule.enabled || !matchesRule(rule, bookmark, hostname)) continue;

    const details = {
      ruleId: rule.id,
      confidence: rule.confidence,
      matchType: rule.matchType,
      pattern: rule.pattern,
    } satisfies {
      ruleId: string;
      confidence: number;
      matchType: RuleMatchType;
      pattern: string;
    };

    if (rule.confidence < settings.confidenceThreshold) {
      return {
        kind: "unresolved",
        reasonCode: "below_threshold",
        ...details,
      };
    }

    return {
      kind: "match",
      destinationFolderId: rule.destinationFolderId,
      reasonCode: "rule_match",
      ...details,
    };
  }

  return { kind: "unresolved", reasonCode: "no_rule_match" };
}
