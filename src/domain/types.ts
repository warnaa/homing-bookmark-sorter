export const SETTINGS_SCHEMA_VERSION = 1;
export const ACTIVITY_LIMIT = 100;
export const UNDO_WINDOW_MS = 10 * 60 * 1000;

export type RuleMatchType =
  | "exact_domain"
  | "domain_suffix"
  | "url_pattern"
  | "title_keyword";

export interface Rule {
  id: string;
  enabled: boolean;
  matchType: RuleMatchType;
  pattern: string;
  destinationFolderId: string;
  confidence: number;
}

export interface Settings {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  inboxFolderId: string;
  reviewFolderId: string;
  confidenceThreshold: number;
  rules: Rule[];
}

export interface BookmarkSnapshot {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  unmodifiable?: string;
}

export interface FolderSnapshot {
  id: string;
  parentId?: string;
  title: string;
  unmodifiable?: string;
}

export interface RuleMatch {
  kind: "match";
  ruleId: string;
  destinationFolderId: string;
  confidence: number;
  reasonCode: "rule_match";
  matchType: RuleMatchType;
  pattern: string;
}

export interface UnresolvedClassification {
  kind: "unresolved";
  reasonCode: "no_rule_match" | "below_threshold";
  ruleId?: string;
  confidence?: number;
  matchType?: RuleMatchType;
  pattern?: string;
}

export type ClassificationResult = RuleMatch | UnresolvedClassification;

export type AttemptState = "pending" | "moving";
export type PlannedOutcome = "moved" | "review" | "failed";

export interface WorkAttempt {
  bookmarkId: string;
  observedParentId: string;
  observedUrl: string;
  observedTitle: string;
  observedAt: number;
  state: AttemptState;
  attemptVersion: number;
  targetFolderId?: string;
  plannedOutcome?: PlannedOutcome;
  ruleId?: string;
  confidence?: number;
  reasonCode?: string;
}

export type ActivityOutcome =
  | "moved"
  | "review"
  | "failed"
  | "cancelled";

export interface ActivityRecord {
  id: string;
  bookmarkId: string;
  bookmarkTitle: string;
  outcome: ActivityOutcome;
  fromFolderId: string;
  toFolderId?: string;
  ruleId?: string;
  confidence?: number;
  reasonCode: string;
  occurredAt: number;
  undoExpiresAt?: number;
  undoneAt?: number;
}

export interface ProblemRecord {
  id: string;
  code:
    | "inbox_missing"
    | "review_missing"
    | "destination_missing"
    | "move_failed"
    | "processing_failed";
  folderId?: string;
  bookmarkId?: string;
  occurredAt: number;
}

export interface SuppressedArrival {
  bookmarkId: string;
  parentId: string;
  expiresAt: number;
}

export interface PersistedState {
  settings: Settings;
  attempts: Record<string, WorkAttempt>;
  activity: ActivityRecord[];
  problems: ProblemRecord[];
  suppressions: Record<string, SuppressedArrival>;
  importInProgress: boolean;
}

export type ValidationIssueCode =
  | "inbox_required"
  | "review_required"
  | "threshold_invalid"
  | "same_inbox_and_review"
  | "inbox_missing"
  | "review_missing"
  | "inbox_unwritable"
  | "review_unwritable"
  | "review_inside_inbox"
  | "rule_pattern_required"
  | "rule_confidence_invalid"
  | "rule_destination_required"
  | "rule_destination_missing"
  | "rule_destination_unwritable"
  | "rule_destination_inside_inbox";

export interface ValidationIssue {
  code: ValidationIssueCode;
  ruleId?: string;
}

export function createDefaultSettings(): Settings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    inboxFolderId: "",
    reviewFolderId: "",
    confidenceThreshold: 80,
    rules: [],
  };
}

export function createRule(id = crypto.randomUUID()): Rule {
  return {
    id,
    enabled: true,
    matchType: "exact_domain",
    pattern: "",
    destinationFolderId: "",
    confidence: 100,
  };
}
