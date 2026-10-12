# Homing implementation plan

Status: Local-install MVP completed

Source of truth for behavior: `REQUIREMENTS.md`

## Phase 0 — Confirm the product contract

Deliverables:

- Resolve the open decisions in `REQUIREMENTS.md` that affect data structures.
- Validate folder API behavior on Chrome and Edge, including managed or
  otherwise unwritable nodes.
- Decide whether the MVP uses plain TypeScript with a small build configuration
  or an extension framework.
- Record accepted choices in `docs/DECISIONS.md`.

Exit checks:

- Every MVP requirement has an implementation phase and test level.
- No implementation choice requires page-content permission for URL/title
  classification.

## Phase 1 — Establish the extension shell

Deliverables:

- Manifest V3 extension skeleton.
- TypeScript, linting, formatting, and unit-test configuration.
- Background service worker and browser API adapter.
- Options page, popup/activity shell, and `_locales/en/messages.json`.
- Development loading and build instructions in `README.md`.

Verification:

- Clean install as an unpacked extension in Chrome and Edge.
- Production build contains no development-only secrets or remote code.
- Automated checks pass from a clean checkout.

## Phase 2 — Model folders and settings

Deliverables:

- Bookmark-tree picker showing breadcrumb paths.
- Inbox, Needs review, and arbitrary destination selection.
- Validation against invalid, missing, or unwritable folder combinations.
- Persistent versioned settings schema and safe migration path.
- Reconciliation when folders are renamed, moved, or deleted.

Verification:

- Unit tests for configuration validation and migration.
- Integration tests against a mocked bookmark tree.
- Manual checks for duplicate folder names in different branches.

## Phase 3 — Implement deterministic classification

Deliverables:

- Pure classification engine for exact domains, domain suffixes, URL patterns,
  and title keywords.
- User-editable rule ordering and destinations.
- Confidence threshold and explainable result structure.
- Rule preview against sample URL/title input.

Verification:

- Table-driven unit tests for normalization, internationalized domains,
  malformed URLs, priority, conflicts, and threshold boundaries.
- No browser APIs imported by the classifier module.

## Phase 4 — Build the durable sorting pipeline

Deliverables:

- Direct Inbox arrival detection for created and manually moved bookmarks.
- Durable work records and startup recovery.
- Import suppression.
- Extension-move correlation and duplicate-event protection.
- Pre-move revalidation so manual user decisions win.
- Routing to the matched destination or Needs review.

Verification:

- Integration tests for every acceptance scenario involving events and races.
- Worker-restart test between detection, classification, and move.
- Import burst test proving imported bookmarks are not unintentionally sorted.

## Phase 5 — Add activity, errors, and Undo

Deliverables:

- Bounded recent-activity store.
- Popup or activity page with outcomes and explanations.
- Toolbar error badge.
- Undo with stale-state protection.
- Retry path by returning an item to the Inbox.

Verification:

- Accessibility and keyboard-navigation review.
- Tests for cleared history, expired Undo, deleted bookmarks, and later manual
  moves.
- All visible strings resolved through i18n resources.

## Phase 6 — End-to-end hardening and packaging

Deliverables:

- Browser-driven tests for primary user journeys.
- Permission rationale and privacy disclosure.
- Icons, store copy, screenshots, and release build process.
- Chrome/Edge compatibility matrix.
- Backup and recovery documentation for settings.

Verification:

- Fresh-profile installation and upgrade exercises.
- Manual tests using synchronized bookmarks and duplicate folder names.
- Package inspection confirms expected files and permissions only.
- Requirements-to-tests traceability review.

## Post-MVP candidates

- Optional page metadata and content extraction.
- Opt-in local or remote AI classification with explicit data disclosure.
- Learning suggested rules from manual review decisions.
- Firefox port through the browser adapter.
- Import/export of rules using logical folder-path reconciliation.

Each post-MVP feature requires a separate decision entry covering permissions,
privacy, failure behavior, and migration before implementation.

## Completion record

Completed on 2026-09-24 for the local-install MVP:

- Phases 0 through 5 are implemented.
- Phase 6 is complete for local packaging: automated package inspection,
  Chrome and Edge browser smoke tests, icons, permission documentation, and a
  local testing guide are present.
- Chrome Web Store publication assets and submission remain intentionally out
  of scope in that original local-install completion record.
- Content extraction, AI classification, and Firefox support remain post-MVP
  candidates.

## Store publication follow-up

Requested on 2026-10-12: voluntary email feedback, a first Chrome Web Store
release, and repeatable updates. Packaging, store copy, and GitHub workflows
are prepared. First publication remains pending developer-account registration,
listing setup, public privacy-policy hosting, store imagery, and Google review.
Live API submission and hosted GitHub workflow execution require account setup
and are not covered by local automated tests.
