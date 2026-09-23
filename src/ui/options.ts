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

const repository = new ChromeStateRepository();
let folders: FolderChoice[] = [];
let settings: Settings;

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
const rulesList = requiredElement<HTMLOListElement>("rules-list");
const rulesEmpty = requiredElement<HTMLElement>("rules-empty");
const statusMessage = requiredElement<HTMLElement>("settings-message");

function sendRequest(request: RuntimeRequest): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(request) as Promise<RuntimeResponse>;
}

function showStatus(text: string, isError = false): void {
  statusMessage.textContent = text;
  statusMessage.hidden = false;
  statusMessage.classList.toggle("notice--error", isError);
}

function createFolderOption(
  folder: FolderChoice,
  inboxId: string,
  excludeInbox: boolean,
): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = folder.id;
  option.textContent = folder.path;
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
}

function labelFor(text: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "field";
  const caption = document.createElement("span");
  caption.textContent = text;
  label.append(caption, control);
  return label;
}

function selectForMatchType(rule: Rule): HTMLSelectElement {
  const select = document.createElement("select");
  const matchTypes: RuleMatchType[] = [
    "exact_domain",
    "domain_suffix",
    "url_pattern",
    "title_keyword",
  ];
  for (const type of matchTypes) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = message(`matchType_${type}`);
    select.append(option);
  }
  select.value = rule.matchType;
  select.addEventListener("change", () => {
    rule.matchType = select.value as RuleMatchType;
  });
  return select;
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
  button.setAttribute("aria-label", accessibleLabel);
  button.addEventListener("click", action);
  return button;
}

function renderRules(): void {
  rulesList.replaceChildren();
  rulesEmpty.hidden = settings.rules.length > 0;

  settings.rules.forEach((rule, index) => {
    const item = document.createElement("li");
    item.className = "rule-row";
    item.dataset.ruleId = rule.id;

    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.className = "rule-enabled";
    enabled.checked = rule.enabled;
    enabled.setAttribute("aria-label", message("ruleEnabledLabel", String(index + 1)));
    enabled.addEventListener("change", () => {
      rule.enabled = enabled.checked;
    });

    const pattern = document.createElement("input");
    pattern.type = "text";
    pattern.value = rule.pattern;
    pattern.required = true;
    pattern.placeholder = message("rulePatternPlaceholder");
    pattern.addEventListener("input", () => {
      rule.pattern = pattern.value;
    });

    const confidence = document.createElement("input");
    confidence.type = "number";
    confidence.min = "0";
    confidence.max = "100";
    confidence.step = "1";
    confidence.required = true;
    confidence.value = String(rule.confidence);
    confidence.addEventListener("input", () => {
      rule.confidence = Number(confidence.value);
    });

    const destination = document.createElement("select");
    destination.required = true;
    populateFolderSelect(destination, rule.destinationFolderId, {
      excludeInbox: true,
    });
    destination.addEventListener("change", () => {
      rule.destinationFolderId = destination.value;
    });

    const actions = document.createElement("div");
    actions.className = "rule-actions";
    const up = iconButton("↑", message("moveRuleUpLabel"), () => {
      [settings.rules[index - 1], settings.rules[index]] = [
        settings.rules[index]!,
        settings.rules[index - 1]!,
      ];
      renderRules();
    });
    up.disabled = index === 0;
    const down = iconButton("↓", message("moveRuleDownLabel"), () => {
      [settings.rules[index], settings.rules[index + 1]] = [
        settings.rules[index + 1]!,
        settings.rules[index]!,
      ];
      renderRules();
    });
    down.disabled = index === settings.rules.length - 1;
    const remove = iconButton("×", message("deleteRuleLabel"), () => {
      settings.rules.splice(index, 1);
      renderRules();
    });
    actions.append(up, down, remove);

    item.append(
      enabled,
      labelFor(message("ruleMatchTypeLabel"), selectForMatchType(rule)),
      labelFor(message("rulePatternLabel"), pattern),
      labelFor(message("ruleConfidenceLabel"), confidence),
      labelFor(message("ruleDestinationLabel"), destination),
      actions,
    );
    rulesList.append(item);
  });
}

function refreshDependentFolderSelects(): void {
  settings.inboxFolderId = inboxSelect.value;
  const reviewId = reviewSelect.value;
  populateFolderSelect(reviewSelect, reviewId, { excludeInbox: true });
  renderRules();
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

function formatIssue(issue: ValidationIssue): string {
  const text = message(issueMessageKeys[issue.code]);
  if (!issue.ruleId) return text;
  const index = settings.rules.findIndex((rule) => rule.id === issue.ruleId);
  return message("validationRulePrefix", [String(index + 1), text]);
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
  if (issues.length) {
    showStatus(issues.map(formatIssue).join(" "), true);
    return;
  }

  await repository.saveSettings(settings);
  await sendRequest({ type: "SETTINGS_UPDATED" });
  if (processExistingInput.checked) {
    await sendRequest({ type: "PROCESS_EXISTING" });
    processExistingInput.checked = false;
  }
  showStatus(message("settingsSavedMessage"));
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
  thresholdInput.value = String(settings.confidenceThreshold);
  renderRules();

  inboxSelect.addEventListener("change", refreshDependentFolderSelects);
  requiredElement("add-rule").addEventListener("click", () => {
    settings.rules.push(createRule());
    renderRules();
  });
  form.addEventListener("submit", (event) => {
    void save(event);
  });
}

void initialize().catch(() => {
  showStatus(message("optionsLoadError"), true);
});
