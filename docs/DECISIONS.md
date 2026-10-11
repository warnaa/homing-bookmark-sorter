# Decision log

This file records accepted product and architecture decisions. New entries are
append-only; superseded decisions should point to the newer entry rather than
being silently rewritten.

## D-001: Use the working name Nestmark

- Date: 2026-09-24
- Status: Superseded by D-014

Nestmark conveys the idea that bookmarks are moved from an inbox into an
appropriate home. Store, domain, and trademark availability have not been
verified, so the name may change before publication.

## D-002: Automate one exact Inbox folder only

- Date: 2026-09-24
- Status: Accepted

Nestmark watches URL bookmarks that become direct children of one selected
Inbox. It does not recursively watch Inbox descendants and never processes
bookmarks placed elsewhere. Placement outside the Inbox is presumed deliberate.

## D-003: Allow destinations anywhere writable

- Date: 2026-09-24
- Status: Accepted

Rule destinations may be selected from anywhere in the writable bookmark tree.
Nestmark will not impose or automatically create a “Sorted bookmarks” parent.
Folders are identified by ID and shown with breadcrumb paths to disambiguate
duplicate names.

## D-004: Use a visible Needs review folder

- Date: 2026-09-24
- Status: Accepted

Uncertain and technically failed attempts move to a separately configured Needs
review folder. The bookmark tree therefore exposes unresolved results without
requiring users to inspect extension-local status. Returning a bookmark to the
Inbox explicitly retries it.

## D-005: Prepare all UI for localization immediately

- Date: 2026-09-24
- Status: Accepted

English is the first locale, but all extension-owned UI strings will be stored
in browser i18n resources from the first implementation. User-created bookmark
and folder text remains untouched.

## D-006: Keep content and AI classification outside the MVP

- Date: 2026-09-24
- Status: Accepted

The MVP classifies URL and title metadata with deterministic rules. This keeps
permissions narrow and decisions explainable. Content or remote classification
requires a later explicit privacy and permission decision.

## D-007: Use plain TypeScript without a runtime UI framework

- Date: 2026-09-24
- Status: Accepted

The extension will use browser-native HTML, CSS, and TypeScript modules with a
small compile-and-copy build. This keeps the package inspectable, avoids runtime
dependencies, and makes service-worker and browser-API boundaries explicit.

## D-008: Use ordered first-match rule evaluation

- Date: 2026-09-24
- Status: Accepted

Rules are evaluated in the order shown in settings. The first enabled matching
rule owns the result. Its user-visible confidence is compared with the global
threshold; a match below the threshold goes to Needs review rather than falling
through to a lower-priority rule. This makes rule order authoritative and the
decision easy to explain.

## D-009: Keep profile-specific settings local

- Date: 2026-09-24
- Status: Accepted

Settings, work attempts, problems, and activity use `storage.local`. Folder IDs
are browser-profile-specific and cannot be safely applied on another profile by
syncing them blindly. A future import/export flow must reconcile logical folder
paths explicitly.

## D-010: Bound Undo and activity history

- Date: 2026-09-24
- Status: Accepted

Undo is available for 10 minutes after a confident automatic move, provided the
bookmark is still in the extension-selected destination. Recent activity is
limited to 100 records. Clearing activity does not move or delete bookmarks.

## D-011: Recover durable work with a periodic alarm

- Date: 2026-09-24
- Status: Accepted

Every attempt is persisted before classification or movement. The service
worker reconciles unfinished attempts at startup and from a one-minute alarm,
which is recreated whenever the worker starts. This avoids treating worker
memory as durable state.

## D-012: Refresh folder choices without discarding drafts

- Date: 2026-09-24
- Status: Accepted

The open settings page listens for bookmark-folder creation, removal, rename,
and movement events. It refreshes folder choices automatically while preserving
all unsaved controls. A manual refresh button provides an explicit fallback.

## D-013: Ship Polish alongside English

- Date: 2026-10-11
- Status: Accepted

Nestmark ships English and Polish message catalogs. The browser picks the
catalog matching its UI language and falls back to English, the default locale,
for any other language. The build check rejects a translation that misses a
key, adds an unknown key, or changes `$1`-style substitutions, so a partial
translation cannot silently mix languages.

## D-014: Rename the working name to Homing

- Date: 2026-10-11
- Status: Accepted as a working name; supersedes D-001

The extension is now called Homing, after homing birds that find their way
back to their nest the way a bookmark finds its folder. Earlier entries that say
Nestmark refer to the same product. The icon is a swallow whose tail is a
bookmark ribbon; `public/icons/homing.svg` is the source for the generated PNG
icons (`npm run generate:icons`). Store, domain, and trademark availability
still have not been verified.
