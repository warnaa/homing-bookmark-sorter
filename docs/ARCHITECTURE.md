# Architecture

Status: Implemented for the local-install MVP.

## System boundary

Homing is an event-driven Manifest V3 browser extension. It reads bookmark
metadata and configuration, but the MVP does not read page bodies or contact a
remote classification service.

```text
Browser bookmark events
          |
          v
  Inbox event filter -----> ignore everything outside exact Inbox
          |
          v
 Durable work coordinator
          |
          v
  Pure rule classifier ----> destination + confidence + explanation
          |
          v
 Pre-move revalidation
      |            |
      | valid      | user moved/deleted item
      v            v
 Destination /    cancel without overriding user
 Needs review
```

## Components

### Browser adapter

Owns calls to bookmarks, storage, runtime, i18n, and action/badge APIs. It should
expose application-oriented operations so the classifier and coordinator do
not depend directly on Chromium callback shapes.

### Inbox event filter

Accepts creation and movement events only when a URL bookmark becomes a direct
child of the configured Inbox. It suppresses imports, folder events, and
correlated extension moves.

### Work coordinator

Creates a durable attempt before classification. It enforces one active attempt
per bookmark, resumes interrupted work, and re-reads the bookmark immediately
before moving it. A changed parent means the user has made a newer decision and
the attempt is cancelled.

### Classifier

A pure function receiving normalized bookmark metadata and ordered rules. It
returns either a candidate result with explanation or an unresolved result. It
does not access storage, browser APIs, clocks, or the network.

### Folder registry

Resolves configured browser folder IDs to current folder nodes and breadcrumb
paths. Missing IDs are errors. Duplicate names never influence identity.

### Activity store

Keeps bounded, non-sensitive outcome records for explanation, failures, and
Undo. Activity records are not the authority for bookmark location; the live
bookmark tree is always re-read before mutation.

### User interfaces

- Options: folder selection, rule editing, threshold behavior, history controls.
- Popup/activity: recent outcomes, actionable errors, available Undo, and a
  shortcut that opens Options with a rule suggested from a reviewed bookmark.
- Toolbar badge: unresolved operational/configuration error count.

## Persisted models

The implementation persists the following versioned settings and workflow
concepts in `storage.local`:

```text
Settings
  schemaVersion
  inboxFolderId
  reviewFolderId
  confidenceThreshold
  orderedRules[]

Rule
  id
  enabled
  priority
  conditions[]
  destinationFolderId

WorkAttempt
  bookmarkId
  observedParentId
  observedUrl
  observedAt
  state
  attemptVersion

ActivityRecord
  id
  bookmarkId
  outcome
  ruleId?
  fromFolderId
  toFolderId?
  reasonCode
  occurredAt
  undoExpiresAt?
```

URLs in activity storage should be omitted or minimized unless a concrete UI
need justifies retention.

## Event flow

1. Receive a bookmark creation or movement event.
2. Resolve current settings and ignore the event unless the node is a URL
   bookmark directly inside the Inbox.
3. Ignore an event correlated with a Homing move.
4. Persist a work attempt containing the observed parent and bookmark identity.
5. Run the classifier using current rules.
6. Re-read the bookmark and configured folder targets.
7. Cancel if the bookmark disappeared or no longer has the Inbox as parent.
8. Move to the confident destination, or to Needs review.
9. Persist the outcome, remove the pending attempt, and refresh error UI.

Steps must be restart-safe. Repeating a step after suspension must converge on
the same state rather than duplicating bookmark nodes.

## Permission strategy

The MVP should need the `bookmarks` and `storage` permissions plus only the
minimum UI-related permissions selected during implementation. URL and title
are available from bookmark metadata, so broad host permissions are not part of
the MVP.

Content inspection is a separate post-MVP capability. Native bookmark events do
not constitute the user gesture required for temporary `activeTab` access, so a
future content classifier must choose explicitly between an extension-initiated
save flow, optional host permissions, or reduced metadata-only behavior.

## Known risks

- Folder IDs may not map cleanly between synchronized browser profiles.
- Import events and sync events may arrive in unexpected bursts or order.
- Extension-generated moves can produce events that resemble user actions.
- The service worker may stop between any two asynchronous operations.
- Managed bookmark nodes may be visible but not writable.

These risks require fixtures and event-sequence tests before release, not only
unit tests of the classifier.
