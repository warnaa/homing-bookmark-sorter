import type {
  FolderSnapshot,
  Settings,
  ValidationIssue,
} from "./types.js";

function isWritableFolder(folder: FolderSnapshot | undefined): boolean {
  return folder !== undefined && !folder.unmodifiable;
}

export function isFolderInside(
  folderId: string,
  possibleAncestorId: string,
  folders: ReadonlyMap<string, FolderSnapshot>,
): boolean {
  let current = folders.get(folderId);
  const visited = new Set<string>();

  while (current?.parentId) {
    if (visited.has(current.id)) return false;
    visited.add(current.id);
    if (current.parentId === possibleAncestorId) return true;
    current = folders.get(current.parentId);
  }

  return false;
}

export function validateSettings(
  settings: Settings,
  folders: ReadonlyMap<string, FolderSnapshot>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const inbox = folders.get(settings.inboxFolderId);

  if (!settings.inboxFolderId) issues.push({ code: "inbox_required" });
  else if (!inbox) issues.push({ code: "inbox_missing" });
  else if (!isWritableFolder(inbox)) issues.push({ code: "inbox_unwritable" });

  if (
    !Number.isInteger(settings.confidenceThreshold) ||
    settings.confidenceThreshold < 0 ||
    settings.confidenceThreshold > 100
  ) {
    issues.push({ code: "threshold_invalid" });
  }

  for (const rule of settings.rules) {
    if (!rule.pattern.trim()) {
      issues.push({ code: "rule_pattern_required", ruleId: rule.id });
    }
    if (
      !Number.isInteger(rule.confidence) ||
      rule.confidence < 0 ||
      rule.confidence > 100
    ) {
      issues.push({ code: "rule_confidence_invalid", ruleId: rule.id });
    }

    const destination = folders.get(rule.destinationFolderId);
    if (!rule.destinationFolderId) {
      issues.push({ code: "rule_destination_required", ruleId: rule.id });
    } else if (!destination) {
      issues.push({ code: "rule_destination_missing", ruleId: rule.id });
    } else if (!isWritableFolder(destination)) {
      issues.push({ code: "rule_destination_unwritable", ruleId: rule.id });
    } else if (
      rule.destinationFolderId === settings.inboxFolderId ||
      isFolderInside(rule.destinationFolderId, settings.inboxFolderId, folders)
    ) {
      issues.push({ code: "rule_destination_inside_inbox", ruleId: rule.id });
    }
  }

  return issues;
}
