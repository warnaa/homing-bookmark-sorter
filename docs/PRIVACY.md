# Privacy and permission rationale

Homing performs all bookmark processing inside the browser
extension. It has no analytics, telemetry, remote API, account system, or
automated network destination.

Last updated: 2026-10-12.

## Voluntary feedback

The settings page and popup offer an email link to `damian@warna.pl`. It opens
your email application with the subject Homing. Homing does not attach bookmark
data, settings, or diagnostics and does not send the message itself. If you
choose to send feedback, Damian receives your email address and the content you
choose to include, and uses it to respond and improve Homing. You can request
deletion by emailing the same address. Your email provider processes the
message under its own privacy terms.

## Data handled

Homing reads:

- Bookmark IDs, parent folder IDs, titles, and URLs for bookmarks entering the
  configured Inbox.
- The bookmark folder tree so the user can select Inbox, Needs review, and rule
  destinations.
- Its own local settings, pending work, recent activity, and reported problems.

Homing does not read page bodies, cookies, browsing history, form data, or
page content. It does not translate or modify bookmark titles.

## Permissions

- `bookmarks`: observe direct Inbox arrivals, display folder choices, and move
  classified bookmarks.
- `storage`: persist local settings, restart-safe work attempts, up to 100 recent
  activity records, and operational problems.
- `alarms`: wake the Manifest V3 service worker periodically to reconcile work
  interrupted by suspension.

The manifest declares no host permissions and no content scripts.

## Retention and control

- Activity is capped at 100 records and can be cleared from the popup.
- Operational problems can be dismissed from the popup.
- Extension-local data is removed when the browser removes the extension.
- Bookmark moves remain normal browser bookmark operations and may be included
  in the browser's own bookmark synchronization.

## Future remote features

Content extraction or remote/AI classification is outside the MVP. Such a
feature must remain disabled by default and requires a separate documented
decision covering permissions, consent, transmitted fields, retention, and
failure behavior before implementation.
