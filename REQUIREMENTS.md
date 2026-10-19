# Homing product requirements

Status: MVP implemented

Last updated: 2026-10-19

## 1. Purpose

Homing reduces bookmark filing work without taking control of the complete
bookmark tree. It treats one configured folder as an Inbox, classifies URL
bookmarks entering that folder, and moves confidently classified bookmarks to a
configured destination. Everything else stays in the Inbox for the user to sort
by hand.

## 2. Terminology

- **Inbox**: the single bookmark folder watched for bookmarks to classify.
- **Unsorted bookmark**: a bookmark Homing left in the Inbox because it could
  not be classified confidently or could not be processed successfully.
- **Default save folder**: the folder the browser's bookmark dialog proposes
  for a newly saved bookmark.
- **Destination**: any writable bookmark folder selected as the target of a
  classification rule.
- **Rule**: a user-configured mapping from matching conditions to a destination.
- **Classification attempt**: one processing run for a bookmark entering the
  Inbox.
- **Extension move**: a bookmark move initiated by Homing.
- **Manual move**: a bookmark move initiated outside Homing or after the
  classification attempt began.

## 3. Functional requirements

### 3.1 Folder configuration

- **FR-001** Homing shall let the user select exactly one existing, writable
  bookmark folder as the Inbox.
- **FR-002** Withdrawn by D-017: there is no separate Needs review folder.
- **FR-003** Withdrawn by D-017.
- **FR-004** The Inbox and any folder inside it shall not be valid
  classification destinations.
- **FR-005** A rule destination may be any other writable folder in the
  bookmark tree. Destinations do not need to share a common parent.
- **FR-006** The settings UI shall display a folder's current breadcrumb path,
  while the saved configuration shall identify the folder by browser-provided
  ID.
- **FR-007** Renaming or moving a configured folder shall not break a rule when
  its browser-provided ID remains valid.
- **FR-008** If a configured folder is deleted or becomes unwritable, Homing
  shall report the configuration problem and shall not silently substitute a
  similarly named folder.
- **FR-009** While settings are open, bookmark-folder additions, removals,
  renames, and moves shall refresh the available folder choices without
  discarding unsaved folder selections, rule edits, threshold changes, or the
  process-existing choice.

### 3.2 Watch boundary

- **FR-010** Homing shall process URL bookmarks created directly in the
  configured Inbox.
- **FR-011** Homing shall process URL bookmarks manually moved directly into
  the configured Inbox from another folder, including bookmarks moved out of
  the Inbox and back for a retry.
- **FR-012** Homing shall not process bookmarks created or moved into any
  other folder.
- **FR-013** Homing shall not recursively watch subfolders of the Inbox.
- **FR-014** Homing shall ignore folder nodes and non-URL bookmark nodes.
- **FR-015** Homing shall ignore bookmark events caused by its own completed
  moves.
- **FR-016** Homing shall suspend normal classification during a browser
  bookmark import and shall not accidentally classify imported items as a
  burst of new user bookmarks.
- **FR-017** When the user first selects a non-empty Inbox, Homing shall offer
  an explicit choice between processing existing direct-child bookmarks and
  watching only future arrivals.
- **FR-018** Reordering bookmarks within the Inbox shall not start a
  classification attempt.

### 3.3 Classification

- **FR-020** A classification attempt shall begin with the bookmark URL, title,
  and available rule configuration.
- **FR-021** The initial rule system shall support exact domain, domain suffix,
  URL pattern, and title-keyword conditions.
- **FR-022** User-created explicit rules shall take priority over heuristic or
  optional content-based classification.
- **FR-023** Rules shall have a deterministic priority order visible and
  editable by the user.
- **FR-024** A classification result shall include a destination, confidence,
  and human-readable reason suitable for the activity UI.
- **FR-025** Homing shall move a bookmark to a rule destination only when the
  result meets the configured confidence threshold.
- **FR-026** Optional page-content classification may be added without changing
  the folder-watch contract in this document.
- **FR-027** Optional remote or AI classification shall be disabled by default
  and require informed opt-in before page-derived data leaves the device.

### 3.4 Successful, uncertain, and failed outcomes

- **FR-030** While classification is pending, the bookmark shall remain in the
  Inbox.
- **FR-031** On a confident result, Homing shall move the bookmark to the
  selected destination.
- **FR-032** If no result meets the confidence threshold, Homing shall leave
  the bookmark in the Inbox and record the reason in recent activity.
- **FR-033** If classification or the move fails technically, Homing shall
  leave the bookmark in the Inbox, report the problem, and record a
  non-sensitive failure reason locally.
- **FR-034** If a rule destination is missing or unwritable, Homing shall leave
  the bookmark in the Inbox and surface an actionable configuration error.
- **FR-035** Withdrawn by D-017.
- **FR-036** A bookmark left in the Inbox shall be classified again when it is
  moved out of the Inbox and back, or when the user chooses to sort existing
  Inbox bookmarks while saving settings. Opening settings from a rule
  suggestion shall preselect that choice.
- **FR-037** Homing shall not alter bookmark titles to encode processing
  state.
- **FR-038** After Homing moves a bookmark out of the Inbox, it shall make the
  Inbox the browser's default save folder again. It may do so only with
  temporary folders inside the Inbox that it removes immediately. A failure
  shall not change the sorting outcome or be reported as a problem.

### 3.5 Concurrency and recovery

- **FR-040** Homing shall prevent concurrent attempts for the same bookmark.
- **FR-041** Pending work shall survive Manifest V3 service-worker suspension
  and browser restart.
- **FR-042** Before applying a result, Homing shall verify that the bookmark
  still exists and is still directly inside the Inbox.
- **FR-043** A manual move performed after processing begins shall win over an
  extension result; Homing shall not move the bookmark back.
- **FR-044** Deleting a bookmark shall cancel or clean up its active processing
  record.
- **FR-045** Retrying the same bookmark shall be idempotent and shall not create
  duplicate bookmark nodes.

### 3.6 User interface and auditability

- **FR-050** Homing shall provide a settings interface for selecting the
  Inbox, destinations, rules, and confidence behavior.
- **FR-051** Homing shall provide a recent-activity view showing the outcome,
  destination or failure reason, matched rule, and timestamp.
- **FR-052** The extension toolbar badge shall show the number of unresolved
  configuration or processing problems, not the number of bookmarks waiting in
  the Inbox.
- **FR-053** A successful automatic move shall offer Undo for a bounded period.
- **FR-054** Undo shall return the bookmark to the Inbox only if doing so would
  not overwrite a newer manual decision.
- **FR-055** Activity history shall be stored locally, bounded by retention or
  record count, and clearable by the user.
- **FR-056** Settings and the popup shall offer an email feedback link to
  `damian@warna.pl`. It shall open a user-controlled email draft and shall not
  automatically attach bookmark data, settings, or diagnostics.

### 3.7 Internationalization

- **FR-060** All user-facing extension-owned text shall use browser i18n message
  resources from the first implementation.
- **FR-061** English shall be the initial locale.
- **FR-062** Source code and HTML shall not contain hard-coded user-facing
  English except where browser limitations require a documented exception.
- **FR-063** Existing bookmark titles and user-created folder names shall never
  be translated.
- **FR-064** Dates, numbers, lists, and plural forms shall use locale-aware
  formatting.
- **FR-065** Message keys shall be stable semantic identifiers rather than full
  English sentences.

### 3.8 Privacy and permissions

- **FR-070** Homing shall request only permissions required by enabled
  functionality.
- **FR-071** The deterministic URL/title classifier shall work without reading
  full page content.
- **FR-072** Page-content access shall be optional and explained before the
  corresponding host permissions are requested.
- **FR-073** Bookmark data, activity data, and extracted content shall remain on
  the device unless the user explicitly enables a remote feature.
- **FR-074** Secrets for remote services shall not be embedded in the published
  extension package.
- **FR-075** Logs and diagnostics shall avoid storing complete extracted page
  content.

## 4. Non-functional requirements

- **NFR-001 Reliability:** every detected Inbox arrival shall reach one durable
  state: pending, moved, left in the Inbox, cancelled by user action, or blocked by a
  reported configuration error.
- **NFR-002 Performance:** URL/title rule evaluation should normally complete
  within 250 ms, excluding browser API scheduling and optional remote work.
- **NFR-003 Explainability:** every automatic destination decision shall name
  the rule or classifier reason that produced it.
- **NFR-004 Accessibility:** settings and activity interfaces shall be keyboard
  operable and use semantic controls and accessible names.
- **NFR-005 Compatibility:** the first release shall support current stable
  Chrome and Edge using Manifest V3.
- **NFR-006 Portability:** browser API calls shall be isolated behind a small
  adapter so Firefox support can be assessed without rewriting classification
  logic.
- **NFR-007 Testability:** classification shall be implemented as pure logic
  independently testable from browser APIs.

## 5. MVP scope

The MVP includes:

- Chrome and Edge support.
- Inbox folder selection.
- Destination selection from the complete writable bookmark tree.
- Exact-domain, domain-suffix, URL-pattern, and title-keyword rules.
- Deterministic priority and confidence handling.
- Processing durability and manual-move protection.
- Recent activity, reported errors, and bounded Undo.
- English UI implemented through localization resources.

The MVP excludes:

- Automatic organization outside the Inbox.
- Full-page content extraction.
- AI or remote classification.
- Automatic creation of a managed destination hierarchy.
- Bookmark synchronization independent of the browser.
- A guarantee that local activity metadata synchronizes across devices.

## 6. Acceptance scenarios

1. A bookmark added to a non-Inbox folder remains untouched.
2. A bookmark added to the Inbox and matching a domain rule moves to that
   rule's destination anywhere in the writable bookmark tree.
3. A bookmark matching no sufficiently confident rule stays in the Inbox.
4. A processing error leaves the bookmark in the Inbox and appears in recent
   activity with a useful, non-sensitive reason.
5. After Homing sorts a bookmark, the browser's bookmark dialog proposes the
   Inbox for the next saved bookmark.
6. Moving an unsorted bookmark out of the Inbox and back retries
   classification; reordering it within the Inbox does not.
7. A bookmark manually moved out of the Inbox during classification remains in
   the manually selected folder.
8. Renaming or moving a destination folder preserves rules that reference its
   still-valid folder ID.
9. Deleting a destination blocks affected rules visibly and never redirects
   bookmarks by folder-name guesswork.
10. Suspending and restarting the extension worker does not lose pending work.
11. No user-facing English is hard-coded outside the English locale resources.

## 7. Open product decisions

No product decisions are currently open. Store name availability was resolved
in decision D-015.

The Undo window, activity retention, rule evaluation, and settings-storage
questions were resolved in decisions D-008 through D-010.
