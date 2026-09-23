# Decision log

This file records accepted product and architecture decisions. New entries are
append-only; superseded decisions should point to the newer entry rather than
being silently rewritten.

## D-001: Use the working name Nestmark

- Date: 2026-09-24
- Status: Accepted as a working name

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
