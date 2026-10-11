import { isFolderInside, validateSettings } from "../domain/settings.js";
import {
  createRule,
  type Rule,
  type RuleMatchType,
  type Settings,
  type ValidationIssue,
  type ValidationIssueCode,
} from "../domain/types.js";
import type { RuntimeRequest, RuntimeResponse } from "../shared/messages.js";
import { ChromeStateRepository } from "../storage/repository.js";
import { folderMap, loadFolderChoices, type FolderChoice } from "./folders.js";
import { localizeDocument, message } from "./i18n.js";
import { domainFromUrl, inferMatchType } from "./rule-input.js";

const MATCH_TYPES: RuleMatchType[] = [
  "domain_suffix",
  "exact_domain",
  "url_pattern",
  "title_keyword",
];

const repository = new ChromeStateRepository();
let folders: FolderChoice[] = [];
let settings: Settings;
let folderRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;
let composerTypeChosen = false;
let highlightedRuleId: string | undefined;
let draggedRuleId: string | undefined;
let ruleDropped = false;
let ruleIssues = new Map<string, ValidationIssue[]>();

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: ${id}`);
  return element as T;
}

const form = requiredElement<HTMLFormElement>("settings-form");
const inboxSelect = requiredElement<HTMLSelectElement>("inbox-folder");
const reviewSelect = requiredElement<HTMLSelectElement>("review-folder");
const thresholdInput = requiredElement<HTMLInputElement>("confidence-threshold");
const processExistingInput = requiredElement<HTMLInputElement>("process-existing");
const composerType = requiredElement<HTMLSelectElement>("new-rule-type");
const composerPattern = requiredElement<HTMLInputElement>("new-rule-pattern");
const composerDestination = requiredElement<HTMLSelectElement>(
  "new-rule-destination",
);
const rulesList = requiredElement<HTMLOListElement>("rules-list");
const rulesEmpty = requiredElement<HTMLElement>("rules-empty");
const rulesHeader = requiredElement<HTMLElement>("rules-header");
const rulesCount = requiredElement<HTMLElement>("rules-count");
const statusMessage = requiredElement<HTMLElement>("settings-message");
const unsavedIndicator = requiredElement<HTMLElement>("unsaved-indicator");

function sendRequest(request: RuntimeRequest): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(request) as Promise<RuntimeResponse>;
}

function showStatus(text: string, isError = false): void {
  statusMessage.textContent = text;
  statusMessage.hidden = false;
  statusMessage.classList.toggle("save-bar__message--error", isError);
}

function setDirty(value: boolean): void {
  dirty = value;
  unsavedIndicator.hidden = !value;
}

function folderLabel(folder: FolderChoice): string {
  if (!folder.title || !folder.parentPath) return folder.path;
  return message("folderOptionLabel", [folder.title, folder.parentPath]);
}

function createFolderOption(
  folder: FolderChoice,
  inboxId: string,
  excludeInbox: boolean,
): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = folder.id;
  option.textContent = folderLabel(folder);
  option.title = folder.path;
  const map = folderMap(folders);
  option.disabled =
    Boolean(folder.unmodifiable) ||
    (excludeInbox &&
      (folder.id === inboxId || isFolderInside(folder.id, inboxId, map)));
  return option;
}

function populateFolderSelect(
  select: HTMLSelectElement,
  selectedId: string,
  options: { excludeInbox: boolean },
): void {
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = message("selectFolderPlaceholder");
  select.append(placeholder);

  for (const folder of folders) {
    select.append(
      createFolderOption(folder, inboxSelect.value, options.excludeInbox),
    );
  }

  if (selectedId && !folders.some((folder) => folder.id === selectedId)) {
    const missing = document.createElement("option");
    missing.value = selectedId;
    missing.textContent = message("missingFolderOption", selectedId);
    missing.disabled = true;
    select.append(missing);
  }
  select.value = selectedId;
  select.title = select.selectedOptions[0]?.title ?? "";
}

function populateMatchTypeSelect(
  select: HTMLSelectElement,
  value: RuleMatchType,
): void {
  select.replaceChildren();
  for (const type of MATCH_TYPES) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = message(`matchType_${type}`);
    select.append(option);
  }
  select.value = value;
}

function patternPlaceholder(type: RuleMatchType): string {
  return message(`patternPlaceholder_${type}`);
}

function iconButton(
  text: string,
  accessibleLabel: string,
  action: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.textContent = text;
  button.title = accessibleLabel;
  button.setAttribute("aria-label", accessibleLabel);
  button.addEventListener("click", action);
  return button;
}

function focusHandle(ruleId: string): void {
  rulesList
    .querySelector<HTMLElement>(
      `[data-rule-id="${CSS.escape(ruleId)}"] .rule-handle`,
    )
    ?.focus();
}

function moveRule(from: number, to: number): void {
  if (to < 0 || to >= settings.rules.length || from === to) return;
  const [rule] = settings.rules.splice(from, 1);
  if (!rule) return;
  settings.rules.splice(to, 0, rule);
  setDirty(true);
  renderRules();
  focusHandle(rule.id);
  showStatus(message("ruleMovedMessage", String(to + 1)));
}

/** Applies the order rows were dragged into, or restores it if unchanged. */
function commitDraggedOrder(): void {
  const byId = new Map(settings.rules.map((rule) => [rule.id, rule]));
  const ordered = [...rulesList.querySelectorAll<HTMLElement>(".rule-row")]
    .map((row) => byId.get(row.dataset.ruleId ?? ""))
    .filter((rule): rule is Rule => rule !== undefined);
  const changed =
    ordered.length === settings.rules.length &&
    ordered.some((rule, index) => rule !== settings.rules[index]);
  if (changed) {
    settings.rules = ordered;
    setDirty(true);
  }
  renderRules();
  if (changed && draggedRuleId) {
    const position = ordered.findIndex((rule) => rule.id === draggedRuleId);
    showStatus(message("ruleMovedMessage", String(position + 1)));
  }
}

function draggedRow(): HTMLElement | null {
  return draggedRuleId
    ? rulesList.querySelector<HTMLElement>(
        `[data-rule-id="${CSS.escape(draggedRuleId)}"]`,
      )
    : null;
}

// Dropping anywhere on the page keeps the order shown; Escape cancels.
function handleRuleDragOver(event: DragEvent): void {
  const dragged = draggedRow();
  if (!dragged) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  const target =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>(".rule-row")
      : null;
  if (!target || target === dragged) return;
  const { top, height } = target.getBoundingClientRect();
  const after = event.clientY > top + height / 2;
  rulesList.insertBefore(dragged, after ? target.nextElementSibling : target);
}

function issueText(code: ValidationIssueCode): string {
  return message(issueMessageKeys[code]);
}

function renderRuleRow(rule: Rule, index: number): HTMLLIElement {
  const label = (key: string) => message(key, String(index + 1));
  const item = document.createElement("li");
  item.className = "rule-row";
  item.dataset.ruleId = rule.id;
  item.classList.toggle("rule-row--disabled", !rule.enabled);
  item.classList.toggle("rule-row--new", rule.id === highlightedRuleId);

  // Rows become draggable only while the handle is held, so text selection in
  // the inputs keeps working.
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "rule-handle";
  handle.textContent = "⠿";
  handle.title = label("reorderRuleLabel");
  handle.setAttribute("aria-label", label("reorderRuleLabel"));
  handle.addEventListener("pointerdown", () => {
    item.draggable = true;
  });
  handle.addEventListener("pointerup", () => {
    item.draggable = false;
  });
  handle.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") moveRule(index, index - 1);
    else if (event.key === "ArrowDown") moveRule(index, index + 1);
    else return;
    event.preventDefault();
  });
  item.addEventListener("dragstart", (event) => {
    if (!item.draggable) return;
    draggedRuleId = rule.id;
    ruleDropped = false;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", rule.pattern);
    }
    item.classList.add("rule-row--dragging");
  });
  item.addEventListener("dragend", () => {
    item.draggable = false;
    if (ruleDropped) commitDraggedOrder();
    else renderRules();
    draggedRuleId = undefined;
  });

  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.className = "rule-enabled";
  enabled.checked = rule.enabled;
  enabled.title = label("ruleEnabledLabel");
  enabled.setAttribute("aria-label", label("ruleEnabledLabel"));
  enabled.addEventListener("change", () => {
    rule.enabled = enabled.checked;
    item.classList.toggle("rule-row--disabled", !rule.enabled);
  });

  const matchType = document.createElement("select");
  matchType.className = "rule-type";
  matchType.setAttribute("aria-label", label("ruleMatchTypeRowLabel"));
  populateMatchTypeSelect(matchType, rule.matchType);

  const pattern = document.createElement("input");
  pattern.type = "text";
  pattern.className = "rule-pattern";
  pattern.value = rule.pattern;
  pattern.required = true;
  pattern.spellcheck = false;
  pattern.placeholder = patternPlaceholder(rule.matchType);
  pattern.setAttribute("aria-label", label("rulePatternRowLabel"));
  pattern.addEventListener("input", () => {
    rule.pattern = pattern.value;
  });
  matchType.addEventListener("change", () => {
    rule.matchType = matchType.value as RuleMatchType;
    pattern.placeholder = patternPlaceholder(rule.matchType);
  });

  const confidenceWrapper = document.createElement("span");
  confidenceWrapper.className = "input-with-suffix";
  confidenceWrapper.classList.add("rule-confidence");
  const confidence = document.createElement("input");
  confidence.type = "number";
  confidence.min = "0";
  confidence.max = "100";
  confidence.step = "1";
  confidence.required = true;
  confidence.value = String(rule.confidence);
  confidence.setAttribute("aria-label", label("ruleConfidenceRowLabel"));
  confidence.addEventListener("input", () => {
    rule.confidence = Number(confidence.value);
  });
  const percent = document.createElement("span");
  percent.textContent = "%";
  percent.setAttribute("aria-hidden", "true");
  confidenceWrapper.append(confidence, percent);

  const arrow = document.createElement("span");
  arrow.className = "rule-arrow";
  arrow.textContent = "→";
  arrow.setAttribute("aria-hidden", "true");

  const destination = document.createElement("select");
  destination.required = true;
  destination.className = "rule-destination";
  destination.setAttribute("aria-label", label("ruleDestinationRowLabel"));
  populateFolderSelect(destination, rule.destinationFolderId, {
    excludeInbox: true,
  });
  destination.addEventListener("change", () => {
    rule.destinationFolderId = destination.value;
    destination.title = destination.selectedOptions[0]?.title ?? "";
  });

  const remove = iconButton("×", label("deleteRuleLabel"), () => {
    settings.rules.splice(index, 1);
    ruleIssues.delete(rule.id);
    setDirty(true);
    renderRules();
    const next =
      rulesList.children[Math.min(index, settings.rules.length - 1)];
    (next?.querySelector<HTMLElement>(".rule-delete") ?? composerPattern).focus();
  });
  remove.classList.add("rule-delete");

  item.append(
    handle,
    enabled,
    matchType,
    pattern,
    confidenceWrapper,
    arrow,
    destination,
    remove,
  );

  const issues = ruleIssues.get(rule.id) ?? [];
  if (issues.length) {
    item.classList.add("rule-row--invalid");
    const codes = new Set(issues.map((issue) => issue.code));
    if (codes.has("rule_pattern_required")) pattern.setAttribute("aria-invalid", "true");
    if (codes.has("rule_confidence_invalid")) confidence.setAttribute("aria-invalid", "true");
    if ([...codes].some((code) => code.startsWith("rule_destination"))) {
      destination.setAttribute("aria-invalid", "true");
    }
    const error = document.createElement("p");
    error.className = "rule-error";
    error.textContent = issues.map((issue) => issueText(issue.code)).join(" ");
    item.append(error);
    item.addEventListener(
      "input",
      () => {
        ruleIssues.delete(rule.id);
        item.classList.remove("rule-row--invalid");
        error.remove();
        for (const control of item.querySelectorAll("[aria-invalid]")) {
          control.removeAttribute("aria-invalid");
        }
      },
      { once: true },
    );
  }

  return item;
}

function renderRules(): void {
  rulesList.replaceChildren(...settings.rules.map(renderRuleRow));
  const hasRules = settings.rules.length > 0;
  rulesEmpty.hidden = hasRules;
  rulesHeader.hidden = !hasRules;
  rulesCount.textContent = hasRules
    ? new Intl.NumberFormat(chrome.i18n.getUILanguage()).format(
        settings.rules.length,
      )
    : "";
}

function refreshComposerDestination(): void {
  populateFolderSelect(composerDestination, composerDestination.value, {
    excludeInbox: true,
  });
  if (composerDestination.selectedOptions[0]?.disabled) {
    composerDestination.value = "";
  }
}

function setComposerPattern(text: string): void {
  composerPattern.value = text;
  updateComposerType();
}

function updateComposerType(): void {
  if (!composerTypeChosen) {
    const inferred = inferMatchType(composerPattern.value);
    if (inferred) composerType.value = inferred;
  }
  composerPattern.placeholder = patternPlaceholder(
    composerType.value as RuleMatchType,
  );
}

function addRuleFromComposer(): void {
  const pattern = composerPattern.value.trim();
  if (!pattern) {
    showStatus(issueText("rule_pattern_required"), true);
    composerPattern.focus();
    return;
  }
  if (!composerDestination.value) {
    showStatus(issueText("rule_destination_required"), true);
    composerDestination.focus();
    return;
  }

  const rule: Rule = {
    ...createRule(),
    matchType: composerType.value as RuleMatchType,
    pattern,
    destinationFolderId: composerDestination.value,
  };
  settings.rules.push(rule);
  highlightedRuleId = rule.id;
  setDirty(true);
  renderRules();
  highlightedRuleId = undefined;

  // Keep the destination so several rules for one folder need no extra clicks.
  composerTypeChosen = false;
  setComposerPattern("");
  composerPattern.focus();
  rulesList.lastElementChild?.scrollIntoView({ block: "nearest" });
  showStatus(message("ruleAddedMessage", String(settings.rules.length)));
}

function refreshDependentFolderSelects(): void {
  settings.inboxFolderId = inboxSelect.value;
  const reviewId = reviewSelect.value;
  populateFolderSelect(reviewSelect, reviewId, { excludeInbox: true });
  refreshComposerDestination();
  renderRules();
}

function captureUnsavedControls(): void {
  settings.inboxFolderId = inboxSelect.value;
  settings.reviewFolderId = reviewSelect.value;
  settings.confidenceThreshold = Number(thresholdInput.value);
}

async function refreshFolderChoices(showConfirmation = false): Promise<void> {
  captureUnsavedControls();
  const nextFolders = await loadFolderChoices();
  folders = nextFolders;
  populateFolderSelect(inboxSelect, settings.inboxFolderId, {
    excludeInbox: false,
  });
  populateFolderSelect(reviewSelect, settings.reviewFolderId, {
    excludeInbox: true,
  });
  refreshComposerDestination();
  renderRules();
  if (showConfirmation) showStatus(message("foldersRefreshedMessage"));
}

function scheduleFolderRefresh(): void {
  if (folderRefreshTimer !== undefined) clearTimeout(folderRefreshTimer);
  folderRefreshTimer = setTimeout(() => {
    folderRefreshTimer = undefined;
    void refreshFolderChoices().catch(() => {
      showStatus(message("foldersRefreshError"), true);
    });
  }, 100);
}

function refreshIfFolder(nodeId: string): void {
  void chrome.bookmarks
    .get(nodeId)
    .then((nodes) => {
      if (nodes[0] && !nodes[0].url) scheduleFolderRefresh();
    })
    .catch(() => undefined);
}

const issueMessageKeys: Record<ValidationIssueCode, string> = {
  inbox_required: "validationInboxRequired",
  review_required: "validationReviewRequired",
  threshold_invalid: "validationThresholdInvalid",
  same_inbox_and_review: "validationFoldersMustDiffer",
  inbox_missing: "validationInboxMissing",
  review_missing: "validationReviewMissing",
  inbox_unwritable: "validationInboxUnwritable",
  review_unwritable: "validationReviewUnwritable",
  review_inside_inbox: "validationReviewInsideInbox",
  rule_pattern_required: "validationRulePatternRequired",
  rule_confidence_invalid: "validationRuleConfidenceInvalid",
  rule_destination_required: "validationRuleDestinationRequired",
  rule_destination_missing: "validationRuleDestinationMissing",
  rule_destination_unwritable: "validationRuleDestinationUnwritable",
  rule_destination_inside_inbox: "validationRuleDestinationInsideInbox",
};

const settingsControlsByIssue: Partial<Record<ValidationIssueCode, HTMLElement>> = {
  inbox_required: inboxSelect,
  inbox_missing: inboxSelect,
  inbox_unwritable: inboxSelect,
  review_required: reviewSelect,
  review_missing: reviewSelect,
  review_unwritable: reviewSelect,
  same_inbox_and_review: reviewSelect,
  review_inside_inbox: reviewSelect,
  threshold_invalid: thresholdInput,
};

function formatIssue(issue: ValidationIssue): string {
  const text = issueText(issue.code);
  if (!issue.ruleId) return text;
  const index = settings.rules.findIndex((rule) => rule.id === issue.ruleId);
  return message("validationRulePrefix", [String(index + 1), text]);
}

function showValidationIssues(issues: ValidationIssue[]): void {
  for (const control of Object.values(settingsControlsByIssue)) {
    control.removeAttribute("aria-invalid");
  }
  ruleIssues = new Map();
  for (const issue of issues) {
    if (issue.ruleId) {
      ruleIssues.set(issue.ruleId, [...(ruleIssues.get(issue.ruleId) ?? []), issue]);
    } else {
      settingsControlsByIssue[issue.code]?.setAttribute("aria-invalid", "true");
    }
  }
  renderRules();

  if (!issues.length) return;
  showStatus(issues.map(formatIssue).join(" "), true);
  const first = issues[0]!;
  const target = first.ruleId
    ? rulesList.querySelector<HTMLElement>(
        `[data-rule-id="${CSS.escape(first.ruleId)}"] [aria-invalid]`,
      )
    : settingsControlsByIssue[first.code];
  target?.focus();
}

async function save(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  statusMessage.hidden = true;
  settings = {
    ...settings,
    inboxFolderId: inboxSelect.value,
    reviewFolderId: reviewSelect.value,
    confidenceThreshold: Number(thresholdInput.value),
  };

  const issues = validateSettings(settings, folderMap(folders));
  showValidationIssues(issues);
  if (issues.length) return;

  await repository.saveSettings(settings);
  await sendRequest({ type: "SETTINGS_UPDATED" });
  if (processExistingInput.checked) {
    await sendRequest({ type: "PROCESS_EXISTING" });
    processExistingInput.checked = false;
  }
  setDirty(false);
  showStatus(message("settingsSavedMessage"));
}

function applyPrefilledRule(): void {
  const params = new URLSearchParams(location.search);
  const pattern = params.get("pattern");
  if (!pattern) return;
  history.replaceState(null, "", location.pathname);
  setComposerPattern(domainFromUrl(pattern) ?? pattern);
  composerDestination.focus();
  showStatus(message("rulePrefilledMessage"));
}

async function initialize(): Promise<void> {
  localizeDocument();
  [folders, settings] = await Promise.all([
    loadFolderChoices(),
    repository.getSettings(),
  ]);
  populateFolderSelect(inboxSelect, settings.inboxFolderId, {
    excludeInbox: false,
  });
  populateFolderSelect(reviewSelect, settings.reviewFolderId, {
    excludeInbox: true,
  });
  populateFolderSelect(composerDestination, "", { excludeInbox: true });
  populateMatchTypeSelect(composerType, MATCH_TYPES[0]!);
  updateComposerType();
  thresholdInput.value = String(settings.confidenceThreshold);
  renderRules();

  document.addEventListener("dragover", handleRuleDragOver);
  document.addEventListener("drop", (event) => {
    if (!draggedRuleId) return;
    event.preventDefault();
    ruleDropped = true;
  });
  inboxSelect.addEventListener("change", refreshDependentFolderSelects);
  reviewSelect.addEventListener("change", () => {
    settings.reviewFolderId = reviewSelect.value;
  });
  requiredElement("refresh-folders").addEventListener("click", () => {
    void refreshFolderChoices(true).catch(() => {
      showStatus(message("foldersRefreshError"), true);
    });
  });

  composerType.addEventListener("change", () => {
    composerTypeChosen = true;
    updateComposerType();
  });
  composerPattern.addEventListener("input", updateComposerType);
  composerPattern.addEventListener("paste", (event) => {
    const pasted = event.clipboardData?.getData("text") ?? "";
    const domain = domainFromUrl(pasted);
    if (!domain || composerPattern.value.trim()) return;
    event.preventDefault();
    setComposerPattern(domain);
  });
  const composerControls: HTMLElement[] = [
    composerType,
    composerPattern,
    composerDestination,
  ];
  for (const control of composerControls) {
    control.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addRuleFromComposer();
    });
  }
  requiredElement("add-rule").addEventListener("click", addRuleFromComposer);

  // The composer only drafts a rule; it becomes an unsaved change once added.
  const isComposerControl = (target: EventTarget | null) =>
    target instanceof HTMLElement && Boolean(target.closest(".rule-composer"));
  for (const type of ["input", "change"]) {
    form.addEventListener(type, (event) => {
      if (!isComposerControl(event.target)) setDirty(true);
    });
  }
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) event.preventDefault();
  });
  form.addEventListener("submit", (event) => {
    void save(event).catch(() => {
      showStatus(message("settingsSaveError"), true);
    });
  });

  chrome.bookmarks.onCreated.addListener((_id, node) => {
    if (!node.url) scheduleFolderRefresh();
  });
  chrome.bookmarks.onRemoved.addListener((_id, removeInfo) => {
    if (!removeInfo.node.url) scheduleFolderRefresh();
  });
  chrome.bookmarks.onChanged.addListener((id) => refreshIfFolder(id));
  chrome.bookmarks.onMoved.addListener((id) => refreshIfFolder(id));

  applyPrefilledRule();
}

void initialize().catch(() => {
  showStatus(message("optionsLoadError"), true);
});
